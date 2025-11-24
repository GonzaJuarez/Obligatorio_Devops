#!/usr/bin/env bash
set -euo pipefail

MINIKUBE_PROFILE="${MINIKUBE_PROFILE:-minikube}"

NAMESPACE_MONITORING="monitoring"
NAMESPACE_APP="burgerclicker"
NAMESPACE_JENKINS="jenkins"
NAMESPACE_KYVERNO="kyverno"

command -v minikube >/dev/null 2>&1 || { echo "ERROR: minikube no está instalado" >&2; exit 1; }
command -v kubectl  >/dev/null 2>&1 || { echo "ERROR: kubectl no está instalado" >&2; exit 1; }
command -v helm     >/dev/null 2>&1 || { echo "ERROR: helm no está instalado" >&2; exit 1; }

if ! minikube status -p "$MINIKUBE_PROFILE" >/dev/null 2>&1; then
  echo "Minikube no está corriendo. No hay nada que apagar."
  exit 0
fi

echo "Usando contexto de minikube..."
kubectl config use-context "$MINIKUBE_PROFILE"

### ELIMINAR APLICACIÓN ######################################################

echo "========================================="
echo "Eliminando BurgerClicker..."
echo "========================================="

if helm list -n "${NAMESPACE_APP}" | grep -q burgerclicker; then
  helm uninstall burgerclicker -n "${NAMESPACE_APP}" || echo "ADVERTENCIA: No se pudo desinstalar burgerclicker"
  echo "✓ Release de Helm 'burgerclicker' eliminado"
else
  echo "ℹ Release 'burgerclicker' no encontrado"
fi

if kubectl get namespace "${NAMESPACE_APP}" >/dev/null 2>&1; then
  kubectl delete namespace "${NAMESPACE_APP}" --timeout=60s || true
  echo "✓ Namespace '${NAMESPACE_APP}' eliminado"
fi

### ELIMINAR JENKINS #########################################################

echo ""
echo "========================================="
echo "Eliminando Jenkins..."
echo "========================================="

if kubectl get namespace "${NAMESPACE_JENKINS}" >/dev/null 2>&1; then
  kubectl delete namespace "${NAMESPACE_JENKINS}" --timeout=60s || true
  echo "✓ Namespace '${NAMESPACE_JENKINS}' eliminado"
fi

### ELIMINAR MONITORING ######################################################

echo ""
echo "========================================="
echo "Eliminando Monitoring (Prometheus/Grafana)..."
echo "========================================="

if kubectl get namespace "${NAMESPACE_MONITORING}" >/dev/null 2>&1; then
  kubectl delete namespace "${NAMESPACE_MONITORING}" --timeout=60s || true
  echo "✓ Namespace '${NAMESPACE_MONITORING}' eliminado"
fi

### ELIMINAR POLÍTICAS DE KYVERNO ############################################

echo ""
echo "========================================="
echo "Eliminando políticas de Kyverno..."
echo "========================================="

kubectl delete clusterpolicy disallow-latest-tag --ignore-not-found=true
kubectl delete clusterpolicy disallow-root-user --ignore-not-found=true
kubectl delete clusterpolicy require-container-resources --ignore-not-found=true

echo "✓ Políticas de Kyverno eliminadas"

### ELIMINAR KYVERNO #########################################################

echo ""
echo "========================================="
echo "Eliminando Kyverno..."
echo "========================================="

if helm list -n "${NAMESPACE_KYVERNO}" | grep -q kyverno; then
  helm uninstall kyverno -n "${NAMESPACE_KYVERNO}" || echo "ADVERTENCIA: No se pudo desinstalar kyverno"
  echo "✓ Release de Helm 'kyverno' eliminado"
else
  echo "ℹ Release 'kyverno' no encontrado"
fi

if kubectl get namespace "${NAMESPACE_KYVERNO}" >/dev/null 2>&1; then
  kubectl delete namespace "${NAMESPACE_KYVERNO}" --timeout=120s || true
  echo "✓ Namespace '${NAMESPACE_KYVERNO}' eliminado"
fi

# Limpiar webhooks residuales de Kyverno
echo "Limpiando webhooks de Kyverno..."
kubectl delete validatingwebhookconfigurations.admissionregistration.k8s.io -l app.kubernetes.io/instance=kyverno --ignore-not-found=true
kubectl delete mutatingwebhookconfigurations.admissionregistration.k8s.io -l app.kubernetes.io/instance=kyverno --ignore-not-found=true

### DETENER MINIKUBE #########################################################

echo ""
echo "========================================="
echo "Limpieza completada"
echo "========================================="
echo ""
echo "Todos los componentes eliminados:"
echo "  ✓ BurgerClicker (app)"
echo "  ✓ Jenkins"
echo "  ✓ Monitoring (Prometheus/Grafana)"
echo "  ✓ Kyverno y políticas"
