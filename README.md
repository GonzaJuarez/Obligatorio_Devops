# Obligatorio - BurgerClicker

Este proyecto despliega el juego **BurgerClicker** en **minikube** con:

- Un **backend** (FastAPI).
- Un **frontend** con estrategia **blue/green** (`v1` y `v2`).
- Nginx en el frontend que sirve los archivos estáticos.
---

## 1. Prerrequisitos

- [Minikube](https://minikube.sigs.k8s.io/) instalado.
- `kubectl` configurado para hablar con tu minikube.
---

## 2. Levantar minikube

```bash
minikube start
```
---

## 3. Desplegar los recursos

Aplicar el yaml para desplegar tanto el backend como el frontend:

```bash
kubectl apply -f deploy_minikube.yaml
```

Verifica que los pods estén corriendo:

```bash
kubectl -n burgerclicker get pods
```

---

## 4. Acceder a la aplicación

Redirigimos el puerto 9000 con el comando:

```bash
kubectl -n burgerclicker port-forward svc/frontend-svc 9000:80
```

Esto abre un túnel local al que podemos acceder en:

👉 http://localhost:9000/

---

## 5. Cambiar entre blue y green

Por defecto, el Service apunta a **blue** (`v1`).  
Para enviar tráfico al frontend **green** (`v2`):

```bash
kubectl -n burgerclicker patch svc frontend-svc -p \
  '{"spec":{"selector":{"app":"frontend","color":"green"}}}'
```

Para volver a **blue** (`v1`):

```bash
kubectl -n burgerclicker patch svc frontend-svc -p \
  '{"spec":{"selector":{"app":"frontend","color":"blue"}}}'
```

---

## 6. Limpieza

Para borrar todos los recursos:

```bash
kubectl delete -f deploy_minikube.yaml
```

