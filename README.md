# 🚀 BigQuery Release Pulse

**BigQuery Release Pulse** es una aplicación web interactiva que obtiene, categoriza y presenta en tiempo real las notas de lanzamiento oficiales de Google Cloud BigQuery publicadas en su feed XML Atom (`https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`).

La aplicación está diseñada con un enfoque minimalista y de alto rendimiento utilizando un servidor en **Python Flask** y una interfaz moderna con **HTML, CSS y Javascript nativos (vanilla)**.

---

## 🎨 Características Clave

* **Dashboard de Métricas**: Estadísticas en tiempo real (total de notas, features, cambios e incidencias) calculadas dinámicamente según la búsqueda y filtros aplicados.
* **Filtros Avanzados e Instantáneos**: Búsqueda por palabra clave y filtrado rápido por tipo de actualización mediante botones reactivos sin recargar la página.
* **Segmentación Inteligente**: El servidor desglosa las entradas agrupadas de Google para mostrar cada nota de forma individual.
* **Sistema de Caché Inteligente**: Almacena localmente las notas en un archivo JSON para cargas instantáneas.
* **Botón de Actualización Forzada**: Permite consultar el feed original de Google en vivo con un indicador visual de carga (spinner).
* **Integración con Twitter / X**: Un modal interactivo que ajusta la longitud del texto automáticamente dentro del límite de 280 caracteres, formatea la nota con hashtags y enlaces relevantes, y permite copiar el borrador o tuitearlo directamente.

---

## 📁 Estructura del Proyecto

```text
bq-releases-notes/
├── app.py                   # Servidor web Flask y lógica de parsing/caching
├── requirements.txt         # Dependencias del proyecto (Flask)
├── release_notes_cache.json # Caché de notas en formato JSON (autogenerado)
├── .gitignore               # Configuración para evitar el rastreo de archivos basura
├── templates/
│   └── index.html           # Estructura e interfaz HTML del dashboard
└── static/
    ├── css/
    │   └── style.css        # Diseño responsivo y visual (variables CSS, glassmorphism)
    └── js/
        └── main.js          # Control de estados, buscador, filtros e intent de Twitter
```

---

## ⚙️ Requisitos Previos

Asegúrate de tener instalado Python 3 en tu sistema. Puedes comprobarlo ejecutando:

```bash
py --version
```

---

## 🚀 Instalación y Uso Local

Sigue estos pasos para poner en marcha la aplicación:

### 1. Clonar el repositorio o acceder a la carpeta del proyecto
```bash
cd bq-releases-notes
```

### 2. Instalar dependencias
Instala Flask utilizando el instalador de paquetes de Python (`pip`):
```bash
py -m pip install -r requirements.txt
```

### 3. Iniciar el servidor
Ejecuta el script del backend:
```bash
py app.py
```

### 4. Abrir en el navegador
Visita la siguiente dirección en tu navegador:
👉 **[http://127.0.0.1:5000/](http://127.0.0.1:5000/)**

---

## 📡 Endpoints del Servidor

* `GET /` : Carga el panel visual (interfaz HTML).
* `GET /api/releases` : Devuelve la lista estructurada de actualizaciones en formato JSON.
  * *Parámetro opcional*: `?refresh=true` (obliga al servidor a omitir el caché y descargar la versión viva directamente desde Google Cloud).
