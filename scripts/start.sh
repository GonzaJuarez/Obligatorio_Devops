#!/usr/bin/env bash
set -euo pipefail

### CONFIG BÁSICA ###########################################################

MINIKUBE_PROFILE="${MINIKUBE_PROFILE:-minikube}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHART_DIR="${ROOT_DIR}/helm/burgerclicker"
JENKINS_MANIFEST="${ROOT_DIR}/k8s/deploy-jenkins.yaml"
KYVERNO_POLICIES_DIR="${ROOT_DIR}/k8s/kyverno/"
PROMETHEUS_MANIFEST="${ROOT_DIR}/k8s/monitoring/prometheus.yaml"
GRAFANA_MANIFEST="${ROOT_DIR}/k8s/monitoring/grafana.yaml"

NAMESPACE_MONITORING="monitoring"
NAMESPACE_APP="burgerclicker"
NAMESPACE_JENKINS="jenkins"
NAMESPACE_KYVERNO="kyverno"

### VERIFICAR DEPENDENCIAS ##################################################

command -v minikube >/dev/null 2>&1 || { echo "ERROR: minikube no está instalado" >&2; exit 1; }
command -v kubectl  >/dev/null 2>&1 || { echo "ERROR: kubectl no está instalado" >&2; exit 1; }
command -v helm     >/dev/null 2>&1 || { echo "ERROR: helm no está instalado" >&2; exit 1; }

if [ ! -d "$CHART_DIR" ]; then
  echo "ERROR: no se encontró el chart de Helm en: $CHART_DIR" >&2
  exit 1
fi

if [ ! -f "$JENKINS_MANIFEST" ]; then
  echo "ERROR: no se encontró el manifest de Jenkins en: $JENKINS_MANIFEST" >&2
  exit 1
fi

### MINIKUBE ###############################################################

if ! minikube status -p "$MINIKUBE_PROFILE" >/dev/null 2>&1; then
  echo "Falta minikube, arrancando..."
  minikube start -p "$MINIKUBE_PROFILE" --driver=docker
fi

echo "Usando contexto de minikube..."
kubectl config use-context "$MINIKUBE_PROFILE"

## KYVERNO ##################################################################

if ! kubectl get ns "${NAMESPACE_KYVERNO}" >/dev/null 2>&1; then
  kubectl create namespace "${NAMESPACE_KYVERNO}"
  helm repo add kyverno https://kyverno.github.io/kyverno/
  helm repo update
  helm install kyverno kyverno/kyverno -n "${NAMESPACE_KYVERNO}" --create-namespace
fi

kubectl wait --for=condition=Available deployment/kyverno-admission-controller -n "${NAMESPACE_KYVERNO}" --timeout=300s || true

echo "Desplegando políticas de Kyverno..."

if [ ! -d "$KYVERNO_POLICIES_DIR" ]; then
  echo "ADVERTENCIA: no existe el directorio de políticas Kyverno: $KYVERNO_POLICIES_DIR" >&2
  exit 1
fi

kubectl apply -f "${KYVERNO_POLICIES_DIR}"

### DESPLEGAR APLICACIÓN ####################################################

helm install burgerclicker "$CHART_DIR" -n "${NAMESPACE_APP}" --wait --timeout 300s --create-namespace

kubectl wait --for=condition=Available deployment/frontend -n "${NAMESPACE_APP}" --timeout=120s || true
kubectl wait --for=condition=Available deployment/backend  -n "${NAMESPACE_APP}" --timeout=120s || true

echo "Aplicación desplegada en el namespace '${NAMESPACE_APP}'."

### DESPLEGAR JENKINS #######################################################

kubectl create namespace "${NAMESPACE_JENKINS}" --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f "$JENKINS_MANIFEST"
kubectl wait --for=condition=Available deployment/jenkins -n "${NAMESPACE_JENKINS}" --timeout=300s || true

echo "Jenkins desplegado en el namespace '${NAMESPACE_JENKINS}'."

### DESPLEGAR GRAFANA #######################################################

if [ ! -f "$PROMETHEUS_MANIFEST" ]; then
  echo "ERROR: no se encontró el manifest de Prometheus en: $PROMETHEUS_MANIFEST" >&2
  exit 1
fi

if [ ! -f "$GRAFANA_MANIFEST" ]; then
  echo "ERROR: no se encontró el manifest de Grafana en: $GRAFANA_MANIFEST" >&2
  exit 1
fi

kubectl apply -f "$PROMETHEUS_MANIFEST"
kubectl apply -f "$GRAFANA_MANIFEST"

kubectl wait --for=condition=Available deployment/prometheus -n "${NAMESPACE_MONITORING}" --timeout=300s || true
kubectl wait --for=condition=Available deployment/grafana    -n "${NAMESPACE_MONITORING}" --timeout=300s || true

### RESUMEN ################################################################

echo --------------------------------------------------------
echo "Despliegue completado."
echo --------------------------------------------------------
echo
echo "- Pods en namespace ${NAMESPACE_APP}:"
kubectl get pods -n "${NAMESPACE_APP}"

echo
echo "- Pods en namespace ${NAMESPACE_JENKINS}:"
kubectl get pods -n "${NAMESPACE_JENKINS}"

echo
echo "- Para acceder al FRONTEND:"
echo "    minikube service frontend-svc -n ${NAMESPACE_APP} --url -p ${MINIKUBE_PROFILE}"
echo
echo "- Para acceder a JENKINS:"
echo "    minikube service jenkins-svc -n ${NAMESPACE_JENKINS} --url -p ${MINIKUBE_PROFILE}"
echo
echo "- Para acceder a GRAFANA:"
echo "    minikube service grafana -n ${NAMESPACE_MONITORING} --url -p ${MINIKUBE_PROFILE}"