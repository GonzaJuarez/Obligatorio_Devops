# Image Analysis Report

## Backend Image — burger-back:lab4

### Resumen del análisis
- Fuente: Docker (local)
- Eficiencia total: 99.9995%
- Espacio desperdiciado: 613 bytes
- Desperdicio relativo (userWastedPercent): 0.0009%
- Resultado final: PASS

### Archivos ineficientes detectados
| Count | Wasted Space | Path                  |
|-------|--------------|-----------------------|
| 2     | 613 B        | /usr/lib/os-release   |
| 2     | 0 B          | /tmp                  |
| 2     | 0 B          | /root                 |

### Evaluación de reglas
- PASS: highestUserWastedPercent
- PASS: lowestEfficiency
- SKIP: highestWastedBytes (regla deshabilitada)

---

## Frontend Image — burger-front:lab4

### Resumen del análisis
- Fuente: Docker (local)
- Eficiencia total: 99.9943%
- Espacio desperdiciado: 388 bytes
- Desperdicio relativo (userWastedPercent): 0.0108%
- Resultado final: PASS

### Archivos ineficientes detectados
| Count | Wasted Space | Path                        |
|-------|--------------|-----------------------------|
| 2     | 388 B        | /nginx/etc/default.conf     |

### Evaluación de reglas
- PASS: highestUserWastedPercent
- PASS: lowestEfficiency
- SKIP: highestWastedBytes (regla deshabilitada)
