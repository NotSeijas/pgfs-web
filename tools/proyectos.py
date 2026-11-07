"""Datos del mapa de proyectos (data/proyectos.json).

Uso:
  python tools/proyectos.py plantilla RUTA.xlsx
      Crea la plantilla de Excel que llena el ingeniero.
  python tools/proyectos.py importar RUTA.xlsx [--kml CARPETA]
      Lee la plantilla llena y escribe data/proyectos.json. Los KML nombrados en
      la columna "Archivo KML" se buscan en CARPETA y se dibujan como área.

Los nombres en inglés se completan después en data/proyectos.json
(campo nombre.en); si faltan, el mapa muestra el nombre en español.
Las coordenadas de cada distrito se completan con --coords (JSON
{"Distrito|Provincia": [lat, lon]}) cuando el Excel no trae latitud/longitud.
"""
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'proyectos.json'

CATEGORIAS = {
    'forestal': {'es': 'Gestión forestal', 'en': 'Forest management', 'color': '#C9E265'},
    'rpas': {'es': 'Monitoreo con drones', 'en': 'Drone monitoring', 'color': '#C8763F'},
    'ambiente': {'es': 'Ambiente y territorio', 'en': 'Environment and land', 'color': '#7FC4D8'},
    'obra': {'es': 'Ingeniería y obra', 'en': 'Engineering & works', 'color': '#F2E3B3'},
}
COLUMNAS = [
    ('Nombre del proyecto', 38, 'Ej.: Censo forestal en concesión maderable'),
    ('Servicio', 24, 'Elija de la lista'),
    ('Distrito', 16, ''),
    ('Provincia', 16, ''),
    ('Región', 14, ''),
    ('Año', 8, 'Año de ejecución'),
    ('Hectáreas', 11, 'Si aplica'),
    ('N° de árboles', 12, 'Si aplica (censos, CITES)'),
    ('Cliente o entidad', 26, 'Solo se publica si autoriza'),
    ('¿Mostrar cliente?', 12, 'Sí / No'),
    ('Archivo KML', 20, 'Opcional: nombre del archivo'),
    ('Fotos', 28, 'Nombres de 1 a 3 fotos, separadas por coma'),
    ('Latitud', 10, 'Opcional'),
    ('Longitud', 10, 'Opcional'),
    ('Notas', 30, 'Cualquier detalle adicional'),
]
EJEMPLO = ['Censo forestal en concesión maderable', 'Gestión forestal', 'Callería', 'Coronel Portillo', 'Ucayali',
           2025, 1250, 3480, 'Concesionario forestal (ejemplo)', 'No', 'concesion-1.kml', 'censo1.jpg, censo2.jpg', '', '', '']


def plantilla(dest):
    wb = Workbook()
    ws = wb.active
    ws.title = 'Proyectos'
    head = PatternFill('solid', fgColor='0B231A')
    for i, (titulo, ancho, _) in enumerate(COLUMNAS, 1):
        c = ws.cell(row=1, column=i, value=titulo)
        c.font = Font(bold=True, color='E4EBE2')
        c.fill = head
        c.alignment = Alignment(vertical='center', wrap_text=True)
        ws.column_dimensions[c.column_letter].width = ancho
    for i, (_, _, ayuda) in enumerate(COLUMNAS, 1):
        c = ws.cell(row=2, column=i, value=ayuda)
        c.font = Font(italic=True, size=9, color='56665C')
    for i, v in enumerate(EJEMPLO, 1):
        c = ws.cell(row=3, column=i, value=v)
        c.font = Font(color='8A978F')
        c.fill = PatternFill('solid', fgColor='EEF2EC')
    ws.cell(row=3, column=15, value='FILA DE EJEMPLO: puede borrarla').font = Font(bold=True, color='C8763F')
    ws.row_dimensions[1].height = 30
    ws.freeze_panes = 'A4'

    servicios = DataValidation(type='list', formula1='"' + ','.join(c['es'] for c in CATEGORIAS.values()) + '"', allow_blank=True)
    sino = DataValidation(type='list', formula1='"Sí,No"', allow_blank=True)
    ws.add_data_validation(servicios)
    ws.add_data_validation(sino)
    servicios.add('B3:B200')
    sino.add('J3:J200')

    guia = wb.create_sheet('Instrucciones')
    pasos = [
        'Mapa de proyectos: cómo llenar esta plantilla',
        '',
        '1. Escriba un proyecto por fila en la hoja "Proyectos", desde la fila 4 (la fila 3 es un ejemplo).',
        '2. "Servicio": elija de la lista el área que mejor describe el proyecto.',
        '3. "Distrito / Provincia / Región": con eso ubicamos el punto en el mapa (ubicación aproximada).',
        '4. "Hectáreas" y "N° de árboles": solo si aplican; deje vacío si no.',
        '5. "Cliente o entidad": solo se muestra en la web si en "¿Mostrar cliente?" pone Sí.',
        '6. "Archivo KML": si tiene el KML o shapefile del área, escriba el nombre del archivo y envíelo junto con este Excel.',
        '7. "Fotos": escriba los nombres de 1 a 3 fotos y envíelas aparte. No use fotos con logos o uniformes de entidades.',
        '8. "Latitud / Longitud": opcional, si prefiere un punto exacto.',
        '',
        'Antes de publicar, usted revisa y aprueba cada ficha.',
    ]
    for r, t in enumerate(pasos, 1):
        guia.cell(row=r, column=1, value=t).font = Font(bold=(r == 1), size=13 if r == 1 else 11)
    guia.column_dimensions['A'].width = 110
    wb.move_sheet('Instrucciones', offset=-1)
    wb.active = 1
    wb.save(dest)
    print('OK ->', dest)


def slug(text):
    t = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')


def numero(v):
    if v in (None, ''):
        return None
    if isinstance(v, (int, float)):
        return int(v) if float(v).is_integer() else v
    v = str(v).replace(',', '').replace(' ', '').strip()
    return int(float(v)) if v else None


def leer_kml(path, max_puntos=400):
    """Primer polígono del KML como geometría GeoJSON (lon, lat)."""
    ns = {'k': 'http://www.opengis.net/kml/2.2'}
    tree = ET.parse(path)
    nodo = tree.find('.//k:Polygon//k:outerBoundaryIs//k:coordinates', ns) or tree.find('.//{*}coordinates')
    if nodo is None:
        raise ValueError(f'{path.name}: no tiene polígono')
    pts = [tuple(float(x) for x in p.split(',')[:2]) for p in nodo.text.split()]
    paso = max(1, len(pts) // max_puntos)
    pts = pts[::paso] + ([pts[-1]] if pts[-1] != pts[::paso][-1] else [])
    anillo = [[round(lon, 5), round(lat, 5)] for lon, lat in pts]
    return {'type': 'Polygon', 'coordinates': [anillo]}


def centro(geom):
    pts = geom['coordinates'][0]
    return [round(sum(p[1] for p in pts) / len(pts), 4), round(sum(p[0] for p in pts) / len(pts), 4)]


def importar(xlsx, kml_dir=None, coords_file=None):
    previo = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {}
    en_previo = {p['id']: p['nombre'].get('en') for p in previo.get('proyectos', []) if not previo.get('ejemplo')}
    coords = json.loads(Path(coords_file).read_text(encoding='utf-8')) if coords_file else {}
    por_nombre = {c['es'].lower(): k for k, c in CATEGORIAS.items()}

    ws = load_workbook(xlsx, data_only=True)['Proyectos']
    proyectos, faltan = [], []
    for fila in ws.iter_rows(min_row=3, values_only=True):
        fila = list(fila) + [None] * (len(COLUMNAS) - len(fila))
        nombre, servicio, dist, prov, reg, anio, ha, arb, cliente, mostrar, kml, fotos, lat, lon, notas = fila[:15]
        if not nombre or (notas and 'EJEMPLO' in str(notas).upper()):
            continue
        cat = por_nombre.get(str(servicio or '').strip().lower())
        if not cat:
            faltan.append(f'{nombre}: servicio "{servicio}" no está en la lista')
            continue
        area = leer_kml(Path(kml_dir) / str(kml).strip()) if kml and kml_dir else None
        if lat not in (None, '') and lon not in (None, ''):
            punto = [float(lat), float(lon)]
        elif area:
            punto = centro(area)
        else:
            punto = coords.get(f'{dist}|{prov}')
        if not punto:
            faltan.append(f'{nombre}: falta coordenada para "{dist}|{prov}"')
        pid = slug(f'{nombre}-{dist}-{anio}')
        proyectos.append({
            'id': pid,
            'categoria': cat,
            'anio': numero(anio),
            'nombre': {'es': str(nombre).strip(), 'en': en_previo.get(pid) or ''},
            'lugar': {'distrito': dist or '', 'provincia': prov or '', 'region': reg or ''},
            'coord': punto,
            'hectareas': numero(ha),
            'arboles': numero(arb),
            'cliente': str(cliente).strip() if cliente and str(mostrar or '').strip().lower() in ('sí', 'si') else None,
            'fotos': [f'/media/proyectos/{slug(Path(f.strip()).stem)}-800.webp' for f in str(fotos or '').split(',') if f.strip()][:3],
            'area': area,
        })
    if faltan:
        print('Revise antes de publicar:', *('  - ' + f for f in faltan), sep='\n', file=sys.stderr)
    proyectos.sort(key=lambda p: (-(p['anio'] or 0), p['nombre']['es']))
    data = {'ejemplo': False, 'categorias': CATEGORIAS, 'proyectos': proyectos}
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'OK -> {OUT.relative_to(ROOT)} ({len(proyectos)} proyectos)')


if __name__ == '__main__':
    args = sys.argv[1:]
    opt = lambda name: args[args.index(name) + 1] if name in args else None
    if args[:1] == ['plantilla'] and len(args) > 1:
        plantilla(args[1])
    elif args[:1] == ['importar'] and len(args) > 1:
        importar(args[1], opt('--kml'), opt('--coords'))
    else:
        print(__doc__)
