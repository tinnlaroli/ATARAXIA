# Catálogo wellness — guía de anotación

Features numéricas en escala **0.0–1.0** para el matchmaking.

## `nivel_aislamiento`

Distancia percibida de zonas urbanas / densidad turística.

| Rango | Significado |
|-------|-------------|
| 0.0–0.3 | Urbano o muy accesible |
| 0.4–0.6 | Semi-rural |
| 0.7–1.0 | Remoto, naturaleza predominante |

## `restauracion_pasiva`

Silencio, ritmo lento, restricción de dispositivos, spa/termas.

| Rango | Significado |
|-------|-------------|
| 0.0–0.3 | Actividades sociales o ruidosas |
| 0.4–0.6 | Mixto |
| 0.7–1.0 | Retiro, spa, termas, silencio |

## `demanda_fisica`

Esfuerzo corporal requerido.

| Rango | Significado |
|-------|-------------|
| 0.0–0.2 | Masaje, hidroterapia |
| 0.3–0.5 | Caminatas cortas |
| 0.6–1.0 | Senderismo intenso, escalada |

## `categoria_principal`

`Termal`, `Retiro_Silencio`, `Ecoturismo_Activo`, `Spa`, `Montaña`, `Bosque`, `Playa`, `Lago`, `Desierto`, `Cultural_Wellness`

## Regenerar CSV

```bash
python MODELO/scripts/build_destinos_seed.py
```
