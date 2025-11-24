# Laboratorio 4 – Trabajo integrador


## 1. Descripción general  
Se tomó el proyecto BurgerClicker y se automatizó todo el ciclo DevOps / DevSecOps: contenerización, despliegue con Helm, pipeline CI/CD con Jenkins, políticas de seguridad con Kyverno y monitoreo con Prometheus + Grafana.  
Todo corre sobre Minikube mediante un script único que inicializa dependencias, instala operadores, despliega la aplicación y activa la observabilidad.

---

## 2. Arquitectura final  
**Componentes principales:**

- **Aplicación BurgerClicker** (backend + frontend) desplegada con Helm en `burgerclicker`.
- **Jenkins** en el namespace `jenkins` para CI/CD.
- **Kyverno** en `kyverno`, actuando como admission controller.
- **Prometheus + Grafana** en `monitoring` para métricas y visualización.
- **Minikube** como entorno Kubernetes local.

La arquitectura incluye:
- Pods de frontend y backend.
- Ingreso a servicios mediante `minikube service`.
- Dashboard personalizado montado automáticamente en Grafana.
- Webhooks de Kyverno aplicando políticas de seguridad.

---

## 3. Contenerización  
- Imágenes con etiquetas de versión fija, sin usuario root, optimizadas con multi-stage.
- Se ejecutaron Snyk/Trivy para vulnerabilidades.
- El script realiza `docker pull` de las imágenes actualizadas antes del despliegue.

---

## 4. Automatización del despliegue (`start.sh`)

### 4.1 Validación del entorno  
- Verifica presencia de `minikube`, `kubectl`, `helm`.  
- Verifica existencia de chart, manifests y directorios necesarios.

### 4.2 Inicialización de Minikube  
- Arranca el cluster si no existe.  
- Configura el contexto.  
- Actualiza imágenes del proyecto desde el registry.

### 4.3 Instalación de Kyverno  
- Crea namespace.  
- Instala Kyverno vía Helm.  
- Espera readiness.  
- Verifica webhooks.  
- Aplica todas las políticas almacenadas en `k8s/kyverno/`.

### 4.4 Despliegue de la aplicación  
- Ejecuta `helm upgrade --install` sobre BurgerClicker.  
- Espera readiness del frontend y backend.  
- Si falla, imprime logs, eventos y diagnóstico automático.

### 4.5 Jenkins  
- Crea namespace.  
- Aplica manifiesto propio.  
- Espera readiness.

### 4.6 Prometheus + Grafana  
- Aplica manifest de Prometheus.  
- Aplica manifest de Grafana.  
- Si existe un dashboard JSON, lo convierte en ConfigMap y lo monta automáticamente.  
- Espera readiness de ambos.

### 4.7 Output final del script  
Imprime:
- Pods por namespace.  
- Comandos para acceder a frontend, Jenkins y Grafana mediante `minikube service`.

---

## 5. Pipeline CI/CD  
El Jenkinsfile implementa:

- Clonación del repositorio.  
- Semgrep para análisis estático.  
- Snyk para dependencias.  
- Build y test.  
- Build y push de imagen Docker.  
- Despliegue automático via Helm.  

El pipeline se detiene ante vulnerabilidades críticas.

---

## 6. Seguridad integrada

### 6.1 Semgrep  
Análisis estático. Resultados almacenados en `/reports/semgrep-report.txt`.

### 6.2 Snyk  
Escaneo de dependencias tanto del frontend como del backend. Reportes en `/reports/snyk-frontend-scan.txt` y `/reports/snyk-backend-scan.txt`.

### 6.3 Kyverno  
Políticas aplicadas:

#### 6.3.1 `disallow-latest-tag`
- **Propósito**: Prohibir el uso de la etiqueta `:latest` en imágenes Docker.
- **Severidad**: Media
- **Modo**: Audit
- **Descripción**: La etiqueta `:latest` es mutable y puede causar inconsistencias o fallos graves de seguridad si la imagen cambia. Esta política valida que todas las imágenes especifiquen una etiqueta explícita y que no sea `latest`.
- **Archivo**: `k8s/kyverno/disallow-latest.yaml`

#### 6.3.2 `disallow-root-user`
- **Propósito**: Impedir la ejecución de contenedores como usuario root (UID 0).
- **Severidad**: Alta
- **Modo**: Enforce
- **Descripción**: Ejecutar contenedores como root incrementa el riesgo de escalación de privilegios. Esta política exige `runAsNonRoot: true` y `runAsUser > 0` tanto a nivel de pod como de contenedor.
- **Exclusiones**: Namespaces `kube-system`, `kyverno` y pods de Jenkins con initContainers que requieren permisos especiales.
- **Archivo**: `k8s/kyverno/disallow-root.yaml`

#### 6.3.3 `require-container-resources`
- **Propósito**: Exigir límites y requests de CPU y memoria en todos los contenedores.
- **Severidad**: Alta
- **Modo**: Enforce
- **Descripción**: Los límites de recursos previenen el consumo descontrolado y el "noisy neighbor". Esta política valida que cada contenedor tenga definidos `requests` y `limits` para CPU y memoria.
- **Archivo**: `k8s/kyverno/require-resources.yaml`

**Funcionamiento:**
- Las políticas se aplican automáticamente mediante el script `start.sh` después de instalar Kyverno.
- Kyverno actúa como admission controller, validando y rechazando recursos que incumplan.
- Las políticas en modo `Enforce` bloquean el despliegue; en modo `Audit` solo registran violaciones.

---

## 7. Monitoreo y Observabilidad  
- Prometheus scrapea métricas de la aplicación.  
- Grafana se conecta a Prometheus.  
- Dashboard contiene:
  - RPS  
  - Latencia promedio  
  - CPU / memoria por pod  
  - Métrica de negocio  
- El dashboard JSON está exportado dentro del repositorio.

---

## 8. Scripts del laboratorio  
El proyecto incluye un script (`start.sh`) para:
- Inicializar infraestructura.  
- Instalar operadores.  
- Popular dashboards generando tráfico.  

Y otro script (`shutdown.sh`) para finalizar su ejecución, gracias a esto no queda ningún componente activo del laboratorio, garantizando así una reversión completa del entorno.


---

## 9. Problemas y soluciones

- Webhook de Kyverno lento → se agregó espera adicional.  
- Helm fallaba por pods no listos → se añadieron diagnósticos automáticos.  
- Dashboard no se cargaba → se generó ConfigMap automático.  
- Manifests vacíos → el script detecta archivos sin contenido.

---

## 10. Conclusiones  
- Todo el ciclo DevOps/DevSecOps quedó integrado y automatizado.  
- Se cumplió con monitoreo, seguridad, CI/CD y despliegue GitOps.  
- Posibles mejoras: agregar dashboards adicionales en grafana e implementación de Falco (no se hizo por problemas en la implementación, tanto en windows como en linux).

---
