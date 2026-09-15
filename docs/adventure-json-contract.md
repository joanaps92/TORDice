# Contrato JSON de aventuras (schemaVersion 1)

El contenido editorial de una aventura vive fuera del código del motor. El
administrador puede descargar la plantilla desde `GET
/api/admin/adventures/template`, modificarla y enviarla mediante la pantalla de
administración.

## Campos principales

- `id`: identificador estable con minúsculas, números y guiones. Si se omite al
  importar, TORDice lo deriva del título.
- `schemaVersion`: debe ser `1` en esta versión del motor.
- `titulo`, `descripcion`, `ambientacion`, `duracion`, `dificultad`:
  metadatos obligatorios.
- `tema` y `tono`: arrays opcionales de textos.
- `escenaInicial`: id de una escena existente.
- `escenas`: colección de escenas con `id`, `titulo`, `texto`, `terminal` y
  `decisiones`.

Una decisión usa `texto` y `destino`. Puede incluir `id`, `condiciones`,
`acciones` y una `tirada`. Una tirada de habilidad usa una habilidad de EAU 2ª,
una `dificultad` entera entre 1 y 30 y los destinos `exito` y `fracaso`.

Las escenas terminales no pueden tener decisiones ni tirada. Todas las escenas
deben ser alcanzables desde `escenaInicial`, y todos los destinos deben apuntar
a escenas existentes. El validador devuelve errores con código, mensaje y ruta
JSON para que puedan mostrarse directamente en la interfaz.

## Flujo de publicación

Importar y guardar crea una nueva versión en estado `draft`. Publicar fija esa
versión como `publishedVersion`; despublicar la retira del catálogo de juego.
El JSON original y la representación normalizada se conservan por separado en
la base de datos, por lo que una nueva versión no modifica partidas ya
guardadas.
