"""Genera en/index.html (versión en inglés) a partir de index.html.

Uso:  python tools/build_en.py

Cada texto en español debe existir en index.html; si se cambia un texto en la
versión en español, el script se detiene y avisa cuál falta, para actualizar
aquí su traducción y que ambas versiones no se desfasen.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'index.html'
OUT = ROOT / 'en' / 'index.html'

# Cabecera, enlaces de idioma y rutas (se aplican tal cual, en este orden)
HEAD = [
    ('<html lang="es-PE">', '<html lang="en">'),
    ('<link rel="canonical" href="https://pgfsconsultores.com/">', '<link rel="canonical" href="https://pgfsconsultores.com/en/">'),
    ('<meta property="og:locale" content="es_PE">', '<meta property="og:locale" content="en_US">\n  <meta property="og:locale:alternate" content="es_PE">'),
    ('<meta property="og:url" content="https://pgfsconsultores.com/">', '<meta property="og:url" content="https://pgfsconsultores.com/en/">'),
    ('<a aria-current="page">ES</a>\n      <a href="/en/" hreflang="en" lang="en" aria-label="English">EN</a>',
     '<a href="/" hreflang="es" lang="es" aria-label="Español">ES</a>\n      <a aria-current="page">EN</a>'),
    ('role="group" aria-label="Idioma"', 'role="group" aria-label="Language"'),
]

# Textos (se aplican del más largo al más corto, todas las apariciones)
TEXT = {
    # head / SEO
    'PGFS | Consultoría ambiental, forestal e ingeniería en Perú': 'PGFS | Environmental, Forestry & Engineering Consulting in Peru',
    'Consultora ambiental y forestal en Perú: supervisión forestal, inspecciones CITES, planes de manejo (PGMF, DEMA), inventarios, carbono, estudios ambientales, SIG y obras civiles.':
        'Environmental and forestry consultancy in Peru: forest supervision, CITES inspections, forest management plans (PGMF, DEMA), forest inventories, carbon assessment, environmental studies, GIS and civil works.',
    'consultoría ambiental Perú, consultora forestal, supervisión forestal, inspección CITES, plan de manejo forestal, PGMF, PMFI, DEMA, inventario forestal, evaluación de carbono, estudios ambientales, SST, SIG, cartografía, teledetección, ordenamiento territorial, ZEE, residuos sólidos, reforestación, drones forestales, ingeniería civil, construcción, contrataciones con el Estado, Amazonía, PGFS':
        'environmental consulting Peru, forestry consultant Peru, forest supervision, CITES inspection, forest management plan, forest inventory, forest carbon assessment, environmental impact studies, occupational health and safety, GIS, mapping, remote sensing, land-use planning, solid waste management, reforestation, forestry drones, civil engineering, construction, public procurement, Peruvian Amazon, PGFS',
    'Del bosque a la obra: supervisión forestal, CITES, planes de manejo, estudios ambientales, SIG y construcción en un solo aliado técnico.':
        'From the forest to the build: forest supervision, CITES, management plans, environmental studies, GIS and construction with one technical partner.',
    'Consultora ambiental y forestal con área de ingeniería y construcción en el Perú: supervisión forestal, inspecciones CITES, planes de manejo, inventarios, evaluación de carbono, estudios ambientales, SIG, obras civiles y contrataciones con el Estado.':
        'Environmental and forestry consultancy with an engineering and construction division in Peru: forest supervision, CITES inspections, forest management plans, inventories, carbon assessment, environmental studies, GIS, civil works and public procurement.',
    '"slogan": "Del bosque a la obra"': '"slogan": "From the forest to the build"',
    '"name": "Perú"': '"name": "Peru"',
    '"name": "Servicios"': '"name": "Services"',
    '"Consultoría ambiental"': '"Environmental consulting"',
    '"Gestión forestal"': '"Forest management"',
    '"Supervisión forestal"': '"Forest supervision"',
    '"Inventario forestal"': '"Forest inventory"',
    '"Plan de manejo forestal"': '"Forest management planning"',
    '"Carbono forestal"': '"Forest carbon"',
    '"Teledetección"': '"Remote sensing"',
    '"SIG"': '"GIS"',
    '"Ordenamiento territorial"': '"Land-use planning"',
    '"Residuos sólidos"': '"Solid waste management"',
    '"Ingeniería civil"': '"Civil engineering"',
    '"Construcción"': '"Construction"',
    '"Contrataciones del Estado"': '"Public procurement"',
    '"Amazonía peruana"': '"Peruvian Amazon"',
    '"Planes de manejo forestal (PGMF, PMFI, PO, DEMA) y planes de negocio"': '"Forest management plans (PGMF, PMFI, PO, DEMA) and business plans"',
    '"Sistemas de Información Geográfica (SIG) y cartografía"': '"Geographic Information Systems (GIS) and mapping"',
    '"Ingeniería, construcción y obras civiles"': '"Engineering, construction and civil works"',

    # loader y navegación
    'Leyendo el territorio': 'Reading the land',
    'aria-label="PGFS, inicio"': 'aria-label="PGFS, home"',
    '<em>Consultores &amp; Constructores</em>': '<em>Consultants &amp; Builders</em>',
    'aria-label="Principal"': 'aria-label="Main"',
    '>Nosotros<': '>About<',
    '>Servicios<': '>Services<',
    '>En campo<': '>In the field<',
    '>Equipo<': '>Team<',
    '>Territorio<': '>Territory<',
    '>Contacto<': '>Contact<',
    'Cotizar proyecto': 'Request a quote',
    'aria-label="Abrir menú"': 'aria-label="Open menu"',

    # hero
    '<span>Del bosque</span>': '<span>From the forest</span>',
    '<span>a la <em>obra</em>.</span>': '<span>to the <em>build</em>.</span>',
    'Consultoría ambiental, forestal e ingeniería en Perú': 'Environmental, forestry and engineering consulting in Peru',
    'Supervisión forestal, inspecciones CITES, planes de manejo, estudios ambientales y obras civiles en un solo aliado técnico para instituciones públicas y empresas privadas.':
        'Forest supervision, CITES inspections, management plans, environmental studies and civil works, with a single technical partner for public institutions and private companies.',
    'Solicitar evaluación': 'Request an assessment',
    'Ver servicios': 'View services',
    'Toma con dron · Amazonía peruana': 'Drone footage · Peruvian Amazon',
    'Desliza<i></i>': 'Scroll<i></i>',
    '>INVENTARIO FORESTAL<': '>FOREST INVENTORY<',

    # ticker
    '<span>Supervisión forestal</span><span>Inspecciones CITES</span><span>Inventarios forestales</span><span>Planes de manejo</span><span>Carbono en bosques tropicales</span><span>Drones y teledetección</span><span>SIG y cartografía</span><span>Obras civiles</span><span>Contrataciones con el Estado</span>':
        '<span>Forest supervision</span><span>CITES inspections</span><span>Forest inventories</span><span>Management plans</span><span>Tropical forest carbon</span><span>Drones and remote sensing</span><span>GIS and mapping</span><span>Civil works</span><span>Public procurement</span>',

    # quiénes somos
    'Quiénes somos': 'Who we are',
    'Somos un aliado estratégico que fusiona la ingeniería civil con la consultoría ambiental avanzada y la gestión de recursos forestales. Generamos soluciones técnicas completas para proyectos privados y licitaciones con el Estado, asegurando una transición impecable entre la viabilidad ambiental y la ejecución de infraestructura.':
        'We are a strategic partner that brings together civil engineering, advanced environmental consulting and forest resource management. We deliver complete technical solutions for private projects and public tenders, ensuring a seamless transition from environmental feasibility to infrastructure delivery.',
    '<b>Gestión forestal</b><span>Supervisión, inventarios, planes de manejo y carbono</span>': '<b>Forest management</b><span>Supervision, inventories, management plans and carbon</span>',
    '<b>Ambiente y territorio</b><span>Estudios ambientales, SIG, satélite y residuos</span>': '<b>Environment and land</b><span>Environmental studies, GIS, satellite and waste</span>',
    '<b>Ingeniería y obra</b><span>Construcción pública y privada, edificaciones</span>': '<b>Engineering and construction</b><span>Public and private construction, buildings</span>',
    '<b>Soporte en campo</b><span>Insumos, vehículos y personal técnico</span>': '<b>Field support</b><span>Supplies, vehicles and technical staff</span>',

    # servicios
    '19 servicios,<br>cuatro frentes.': '19 services,<br>four areas.',
    'Cada frente trabaja con el mismo equipo técnico, para que el estudio, el expediente y la ejecución hablen el mismo idioma.':
        'Every area works with the same technical team, so the study, the technical file and the execution all speak the same language.',
    'aria-label="Frentes de servicio"': 'aria-label="Practice areas"',
    'data-tab="0">Gestión forestal<': 'data-tab="0">Forest management<',
    'data-tab="1">Ambiente y territorio<': 'data-tab="1">Environment and land<',
    'data-tab="2">Ingeniería y obra<': 'data-tab="2">Engineering and construction<',
    'data-tab="3">Soporte en campo<': 'data-tab="3">Field support<',

    'Consultoría forestal y supervisión ambiental': 'Forestry consulting and environmental supervision',
    'Brindamos servicios de consultoría y asistencia técnica especializada en la elaboración, revisión y seguimiento de planes de manejo forestal, auditorías quinquenales y monitoreo de títulos habilitantes, incluidos los contratos de cesión en uso para sistemas agroforestales (CUSAF). Asimismo, realizamos inspecciones oculares de especies forestales incluidas en los apéndices CITES, así como evaluaciones técnicas y actividades de campo orientadas a verificar información, documentar resultados y fortalecer la trazabilidad de los recursos forestales, promoviendo su aprovechamiento sostenible y el cumplimiento de la normativa vigente.':
        'We provide consulting and specialized technical assistance in preparing, reviewing and following up forest management plans, five-year audits and the monitoring of forest permits and concessions, including agroforestry use-rights contracts (CUSAF). We also carry out on-site inspections of forest species listed in the CITES appendices, as well as technical assessments and field activities to verify information, document results and strengthen the traceability of forest resources, promoting their sustainable use and compliance with current regulations.',
    'Planes de manejo forestal y planes de negocio': 'Forest management plans and business plans',
    'Formulación de PGMF, PMFI, Planes Operativos (PO) y DEMA. Planes de negocio para concesionarios, comunidades nativas y campesinas, predios privados y organizaciones productivas, orientados al aprovechamiento sostenible y al acceso a financiamiento.':
        'Preparation of general and intermediate forest management plans (PGMF, PMFI), Operating Plans (PO) and DEMA. Business plans for concession holders, indigenous and rural communities, private landholdings and producer organizations, aimed at sustainable use and access to financing.',
    'Inventarios y evaluación de recursos forestales': 'Forest inventories and resource assessment',
    'Realizamos inventarios forestales de alta precisión en áreas comprendidas dentro y fuera de títulos habilitantes, generando información técnica confiable para la formulación de planes de manejo forestal, la evaluación de recursos forestales y la planificación de su aprovechamiento sostenible.':
        'We carry out high-precision forest inventories inside and outside permitted forest areas, producing reliable technical data for forest management plans, forest resource assessment and planning for sustainable harvesting.',
    'Evaluación de carbono en bosques tropicales': 'Carbon assessment in tropical forests',
    'Evaluaciones técnicas y cuantificación de las existencias de carbono en bosques tropicales, abriendo oportunidades en el mercado de mitigación ambiental.':
        'Technical assessment and quantification of carbon stocks in tropical forests, opening opportunities in the climate mitigation market.',
    'Monitoreo con drones y evaluación de concesiones': 'Drone monitoring and concession assessment',
    'Realizamos evaluaciones técnicas de concesiones forestales con fines de conservación, ecoturismo y aprovechamiento maderable, mediante el uso de drones (RPA) y el procesamiento de imágenes satelitales, para monitorear y evaluar de manera eficiente y precisa el estado de conservación del bosque, los cambios en la cobertura forestal y las posibles afectaciones a los recursos forestales.':
        'We carry out technical assessments of forest concessions for conservation, ecotourism and timber production, using drones (RPA) and satellite image processing to efficiently and accurately monitor the condition of the forest, changes in forest cover and potential impacts on forest resources.',
    'Reforestación y conservación ambiental': 'Reforestation and environmental conservation',
    'Desarrollamos proyectos de forestación, reforestación y restauración de áreas degradadas, mediante soluciones técnicas adaptadas a las condiciones ambientales de cada territorio, priorizando el uso de especies nativas y prácticas amigables con el bosque. Asimismo, realizamos evaluaciones de impacto ambiental de proyectos de infraestructura y proponemos medidas para prevenir, mitigar y recuperar las áreas afectadas, contribuyendo a la conservación de la biodiversidad y al equilibrio de los ecosistemas forestales.':
        'We develop afforestation, reforestation and degraded-land restoration projects with technical solutions adapted to the environmental conditions of each area, prioritizing native species and forest-friendly practices. We also carry out environmental impact assessments of infrastructure projects and propose measures to prevent, mitigate and restore affected areas, contributing to biodiversity conservation and the balance of forest ecosystems.',
    'Capacitación ambiental y forestal': 'Environmental and forestry training',
    'Programas de capacitación técnica en gestión ambiental y aprovechamiento forestal para concesionarios, comunidades nativas y campesinas, titulares de predios, estudiantes y demás actores del sector.':
        'Technical training programs in environmental management and forest harvesting for concession holders, indigenous and rural communities, landowners, students and other stakeholders in the sector.',

    'Estudios ambientales, SST y responsabilidad social': 'Environmental, health and safety, and social responsibility studies',
    'Estudios técnicos en medio ambiente, seguridad y salud en el trabajo, calidad y responsabilidad social para minería, construcción, transporte, pesquería, agricultura e industria.':
        'Technical studies in environment, occupational health and safety, quality and social responsibility for mining, construction, transport, fisheries, agriculture and industry.',
    'Ordenamiento territorial y estudios geográficos': 'Land-use planning and geographic studies',
    'Zonificación ecológica y económica (ZEE), demarcación territorial, evaluación de riesgos, estudios topográficos y geodésicos, catastro urbano y rural, y saneamiento físico-legal de predios.':
        'Ecological and economic zoning (ZEE), territorial boundary demarcation, risk assessment, topographic and geodetic surveys, urban and rural cadastre, and physical and legal title regularization of land.',
    'Sistemas de Información Geográfica y cartografía': 'Geographic Information Systems and mapping',
    'Análisis geoespacial avanzado y cartografía temática de alta precisión, adaptada a las necesidades de cada proyecto.':
        'Advanced geospatial analysis and high-precision thematic mapping, tailored to the needs of each project.',
    'Tecnología satelital y monitoreo de cobertura boscosa': 'Satellite technology and forest cover monitoring',
    'Análisis satelital para exploración minera, modelamiento geológico, gestión de riesgos y vigilancia de la vegetación amazónica, con detección de alertas en la cobertura boscosa.':
        'Satellite analysis for mineral exploration, geological modeling, risk management and monitoring of Amazon vegetation, with forest cover change alerts.',
    'Gestión integral de residuos sólidos': 'Integrated solid waste management',
    'Recolección, transporte, tratamiento y disposición final de residuos municipales, industriales, hospitalarios, agropecuarios y de construcción, peligrosos y no peligrosos, conforme a la normativa.':
        'Collection, transport, treatment and final disposal of municipal, industrial, healthcare, agricultural and construction waste, hazardous and non-hazardous, in accordance with regulations.',

    'Ingeniería, construcción y proyectos de envergadura': 'Engineering, construction and large-scale projects',
    'Diseño, supervisión y ejecución de obras civiles, mineras, electromecánicas, hidráulicas, de saneamiento, vías de comunicación y telecomunicaciones.':
        'Design, supervision and execution of civil, mining, electromechanical, hydraulic, sanitation, road and telecommunications works.',
    'Contrataciones con el Estado y obras privadas': 'Public procurement and private works',
    'Consultoría y ejecución de obras públicas y privadas, cumpliendo estrictamente la normativa de contrataciones del Estado para procesos transparentes.':
        'Consulting and execution of public and private works, in strict compliance with Peruvian public procurement regulations for transparent processes.',
    'Edificaciones comerciales, residenciales e institucionales': 'Commercial, residential and institutional buildings',
    'Edificios multifamiliares, viviendas, establecimientos de salud, colegios e infraestructura comercial e industrial.':
        'Multi-family buildings, housing, healthcare facilities, schools and commercial and industrial infrastructure.',
    'Infraestructura deportiva y recreacional': 'Sports and recreational infrastructure',
    'Complejos deportivos, canchas multifuncionales y parques recreacionales que mejoran la calidad de vida de la comunidad.':
        "Sports complexes, multi-purpose courts and recreational parks that improve the community's quality of life.",

    'Provisión de personal y soporte operativo de campo': 'Staffing and field operations support',
    'Personal técnico calificado y ayudantes de campo para levantamiento de información y acompañamiento de brigadas de supervisión, inspección, auditoría y monitoreo.':
        'Qualified technical staff and field assistants for data collection and to support supervision, inspection, audit and monitoring crews.',
    'Suministro de insumos agrícolas y forestales': 'Agricultural and forestry supplies',
    'Fertilizantes, semillas forestales y agrícolas certificadas, herramientas de ferretería y materiales para el trabajo de campo.':
        'Fertilizers, certified forest and agricultural seeds, hardware tools and materials for field work.',
    'Alquiler de vehículos y logística corporativa': 'Vehicle rental and corporate logistics',
    'Flota de vehículos disponible para cubrir los requerimientos logísticos y de transporte de cada proyecto.':
        'A vehicle fleet available to meet the logistics and transport needs of each project.',

    # en campo
    'alt="Medición del perímetro de un tronco con cinta"': 'alt="Measuring a tree trunk circumference with a tape"',
    'alt="Control del dron con el plan de vuelo y un GPS de mano"': 'alt="Drone controller with the flight plan and a handheld GPS"',
    'alt="Técnicos de PGFS lanzando el dron en una chacra"': 'alt="PGFS technicians launching the drone in a farm field"',
    'alt="Dos técnicos de PGFS revisando la ruta de vuelo en campo"': 'alt="Two PGFS technicians reviewing the flight route in the field"',
    '<h2 class="field__title">En campo</h2>': '<h2 class="field__title">In the field</h2>',
    'Monitoreo y evaluación forestal con tecnología RPAS': 'Forest monitoring and assessment with RPAS technology',
    'Evaluamos el estado de las unidades de manejo forestal, incluyendo infraestructura, campamentos, puentes y vías de acceso, e identificamos la pérdida de cobertura boscosa ocasionada por actividades no forestales, mediante tecnología RPAS.':
        'Using RPAS technology, we assess the condition of forest management units, including infrastructure, camps, bridges and access roads, and identify forest cover loss caused by non-forestry activities.',
    'Censo forestal y evaluación dasométrica': 'Forest census and dasometric assessment',
    'Realizamos el levantamiento de datos dasométricos de árboles aprovechables y semilleros, así como la evaluación de unidades de muestreo, registrando especies, diámetros, alturas, volúmenes y ubicación georreferenciada, para sustentar la planificación y el aprovechamiento sostenible de los recursos forestales.':
        'We collect dasometric data on harvestable and seed trees and assess sample plots, recording species, diameters, heights, volumes and georeferenced locations to support planning and the sustainable use of forest resources.',
    'Registro y trazabilidad de información técnica': 'Technical records and traceability',
    'Brindamos servicios de recopilación, organización, georreferenciación y sistematización de información técnica y documental, incluyendo la elaboración de registros, formatos y documentos de sustento que permiten asegurar la trazabilidad de las actividades realizadas y facilitar su verificación y presentación ante las entidades competentes.':
        'We collect, organize, georeference and systematize technical and documentary information, including records, forms and supporting documents that ensure the traceability of the work carried out and make it easy to verify and submit to the relevant authorities.',
    'Inspecciones oculares a planes de manejo': 'On-site inspections of management plans',
    'Ejecutamos servicios especializados de inspección ocular de especies forestales incluidas en los apéndices CITES, mediante contrataciones de servicios tercerizados por el SERFOR, contribuyendo a la verificación técnica, trazabilidad y aprovechamiento legal y sostenible de los recursos forestales.':
        "We carry out specialized on-site inspections of forest species listed in the CITES appendices under outsourced service contracts with SERFOR (Peru's National Forest and Wildlife Service), contributing to the technical verification, traceability and legal, sustainable use of forest resources.",
    'Suministro y gestión de personal': 'Staff supply and management',
    'Brindamos servicios de suministro y asignación de personal calificado y operativo para empresas e instituciones públicas y privadas, de acuerdo con los requerimientos de cada proyecto o actividad. Facilitamos la incorporación de recursos humanos para labores administrativas, técnicas, operativas, de mantenimiento y servicios generales, contribuyendo al cumplimiento de los objetivos empresariales mediante una gestión eficiente, responsable y oportuna del personal.':
        'We supply and assign qualified operational staff to public and private companies and institutions, according to the needs of each project or activity. We help organizations bring in people for administrative, technical, operational, maintenance and general service roles, supporting their business goals through efficient, responsible and timely staff management.',

    # equipo
    'Nuestro equipo en campo': 'Our team in the field',
    'Fotografías de nuestras brigadas durante operaciones de monitoreo con drones (RPAS) en la Amazonía.': 'Photos of our crews during drone (RPAS) monitoring operations in the Amazon.',
    '<b>Despegue en campo abierto</b><span>Monitoreo RPAS</span>': '<b>Take-off in open terrain</b><span>RPAS monitoring</span>',
    '<b>Plan de vuelo y GPS</b><span>Georreferenciación</span>': '<b>Flight plan and GPS</b><span>Georeferencing</span>',
    'alt="Dos técnicos revisando la ruta de vuelo en una tableta"': 'alt="Two technicians reviewing the flight route on a tablet"',
    '<b>Revisión de la ruta</b><span>Trabajo en equipo</span>': '<b>Route check</b><span>Teamwork</span>',
    'alt="Control del dron sobre su maleta con la vista aérea en pantalla"': 'alt="Drone controller on its case showing the aerial view on screen"',
    '<b>Equipo listo para volar</b><span>Antes del vuelo</span>': '<b>Ready to fly</b><span>Pre-flight</span>',
    'alt="Técnico de PGFS operando el control del dron en un pastizal"': 'alt="PGFS technician operating the drone controller in a pasture"',
    '<b>Operación en campo abierto</b><span>Monitoreo RPAS</span>': '<b>Open-field operation</b><span>RPAS monitoring</span>',
    'alt="Pantalla del control mostrando el dosel del bosque"': 'alt="Controller screen showing the forest canopy"',
    '<b>Lectura del dosel en tiempo real</b><span>Imagen desde el dron</span>': '<b>Real-time canopy view</b><span>Drone imagery</span>',
    'alt="Piloto de PGFS con el control del dron junto a un cerco"': 'alt="PGFS pilot with the drone controller next to a fence"',
    '<b>Piloto en terreno</b><span>Evaluación forestal</span>': '<b>Pilot on site</b><span>Forest assessment</span>',
    'alt="Técnicos de PGFS conversando con pobladores de la comunidad"': 'alt="PGFS technicians talking with community members"',
    '<b>Coordinación con la comunidad</b><span>Relacionamiento</span>': '<b>Working with the community</b><span>Community relations</span>',
    'alt="Técnico de PGFS revisando el dron antes de despegar"': 'alt="PGFS technician checking the drone before take-off"',
    '<b>Revisión del dron</b><span>Antes del vuelo</span>': '<b>Drone check</b><span>Pre-flight</span>',

    # visión, misión, valores
    'aria-label="Visión"': 'aria-label="Vision"',
    'alt="Meandro de un río amazónico visto desde un dron"': 'alt="Meander of an Amazon river seen from a drone"',
    'Visión 2031': 'Vision 2031',
    'Ser una empresa líder en soluciones integrales de gestión forestal, ambiental e infraestructura, reconocida por su excelencia técnica, innovación y compromiso con el aprovechamiento sostenible de los recursos naturales y la conservación de los ecosistemas.':
        'To be a leading company in integrated forest, environmental and infrastructure solutions, recognized for technical excellence, innovation and commitment to the sustainable use of natural resources and the conservation of ecosystems.',
    '<h2 class="reveal">Misión</h2>': '<h2 class="reveal">Mission</h2>',
    'Proveer servicios integrales de ingeniería, construcción, consultoría ambiental y gestión forestal sostenible con calidad técnica y legal excepcional, viabilizando proyectos de gran envergadura para clientes públicos y privados mientras promovemos el desarrollo social y la conservación del entorno natural.':
        'To provide integrated engineering, construction, environmental consulting and sustainable forest management services with outstanding technical and legal quality, making large-scale projects possible for public and private clients while promoting social development and the conservation of the natural environment.',
    'Sostenibilidad e impacto positivo': 'Sustainability and positive impact',
    'Soluciones que equilibran el progreso de la infraestructura con el bienestar social y la preservación ambiental.': 'Solutions that balance infrastructure progress with social well-being and environmental protection.',
    'Excelencia técnica e innovación': 'Technical excellence and innovation',
    'Tecnologías avanzadas y estándares metodológicos rigurosos para resultados eficientes.': 'Advanced technologies and rigorous methodological standards for efficient results.',
    'Integridad y cumplimiento normativo': 'Integrity and regulatory compliance',
    'Transparencia y estricta adherencia al marco legal, con seguridad jurídica en cada contrato.': 'Transparency and strict adherence to the legal framework, with legal certainty in every contract.',
    'Compromiso y responsabilidad social': 'Commitment and social responsibility',
    'Relaciones de confianza con comunidades y aliados, aportando valor a cada región.': 'Relationships of trust with communities and partners, adding value to every region.',

    # territorio
    'Territorio que conocemos': 'Land we know',
    'Tomas propias de nuestras jornadas en la Amazonía. Arrastre para recorrerlas.': 'Our own footage from our work in the Amazon. Drag to browse.',
    'aria-label="Foto anterior"': 'aria-label="Previous photo"',
    'aria-label="Foto siguiente"': 'aria-label="Next photo"',
    'aria-roledescription="carrusel" aria-label="Fotos del territorio. Use las flechas del teclado para recorrerlas."': 'aria-roledescription="carousel" aria-label="Photos of the land. Use the arrow keys to browse."',
    'alt="Vista aérea de una comunidad junto al río, rodeada de bosque"': 'alt="Aerial view of a riverside community surrounded by forest"',
    '<figcaption>Comunidad ribereña</figcaption>': '<figcaption>Riverside community</figcaption>',
    'alt="Dron de PGFS volando sobre la ribera del río"': 'alt="PGFS drone flying over the riverbank"',
    '<figcaption>Vuelo sobre la ribera</figcaption>': '<figcaption>Flight over the riverbank</figcaption>',
    'alt="Llanura amazónica con un río serpenteante al fondo"': 'alt="Amazon lowlands with a winding river in the distance"',
    '<figcaption>Llanura aluvial</figcaption>': '<figcaption>Floodplain</figcaption>',
    'alt="Vista cenital de una trocha de acceso en el bosque"': 'alt="Overhead view of an access trail in the forest"',
    '<figcaption>Trocha de acceso</figcaption>': '<figcaption>Access trail</figcaption>',
    'alt="Río ancho bordeado de bosque bajo un cielo nublado"': 'alt="Wide river lined with forest under a cloudy sky"',
    '<figcaption>Ribera y bosque de colina</figcaption>': '<figcaption>Riverbank and hill forest</figcaption>',
    'alt="Interior del bosque con árboles altos"': 'alt="Forest interior with tall trees"',
    '<figcaption>Interior del bosque</figcaption>': '<figcaption>Forest interior</figcaption>',
    'alt="Bosque amazónico continuo visto desde el aire"': 'alt="Continuous Amazon forest seen from the air"',
    '<figcaption>Bosque continuo</figcaption>': '<figcaption>Continuous forest</figcaption>',
    'alt="Borde de bosque visto desde un dron"': 'alt="Forest edge seen from a drone"',
    '<figcaption>Borde de bosque</figcaption>': '<figcaption>Forest edge</figcaption>',
    'alt="Meandro de un río amazónico con playas de arena"': 'alt="Meander of an Amazon river with sandbanks"',
    '<figcaption>Meandro y playas</figcaption>': '<figcaption>Meander and sandbanks</figcaption>',
    'alt="Dosel del bosque visto desde arriba"': 'alt="Forest canopy seen from above"',
    '<figcaption>Dosel del bosque</figcaption>': '<figcaption>Forest canopy</figcaption>',
    'alt="Bosque amazónico con chacras y humo a lo lejos"': 'alt="Amazon forest with farm plots and smoke in the distance"',
    '<figcaption>Bosque y chacras</figcaption>': '<figcaption>Forest and farm plots</figcaption>',

    # contacto
    'Cuéntenos de su proyecto.': 'Tell us about your project.',
    'Respondemos con una propuesta técnica y económica. La primera conversación no tiene costo.': 'We reply with a technical and financial proposal. The first conversation is free of charge.',
    '<dt>Correo</dt>': '<dt>Email</dt>',
    '<dt>Oficina</dt>': '<dt>Office</dt>',
    'Jr. Octavio Monteverde 213, Perú': 'Jr. Octavio Monteverde 213, Peru',
    '<span>Nombre o entidad</span>': '<span>Name or organization</span>',
    '<span>Teléfono</span>': '<span>Phone</span>',
    '<span>Servicio</span>': '<span>Service</span>',
    '<option>Supervisión o consultoría forestal</option>': '<option>Forest supervision or consulting</option>',
    '<option>Plan de manejo o inventario forestal</option>': '<option>Forest management plan or inventory</option>',
    '<option>Inspección CITES</option>': '<option>CITES inspection</option>',
    '<option>Evaluación de carbono</option>': '<option>Carbon assessment</option>',
    '<option>Estudio ambiental o SST</option>': '<option>Environmental or health and safety study</option>',
    '<option>SIG, cartografía o teledetección</option>': '<option>GIS, mapping or remote sensing</option>',
    '<option>Residuos sólidos</option>': '<option>Solid waste</option>',
    '<option>Obra civil o edificación</option>': '<option>Civil works or building</option>',
    '<option>Personal, vehículos o insumos</option>': '<option>Staff, vehicles or supplies</option>',
    '<option>Otro</option>': '<option>Other</option>',
    '<span>Ubicación y detalles</span>': '<span>Location and details</span>',
    'Enviar por WhatsApp': 'Send via WhatsApp',

    # pie
    '¿Su proyecto está en el bosque, en el río o en la ciudad? Lo recorremos con usted.': 'Is your project in the forest, on the river or in the city? We will walk it with you.',
    'Conversemos': "Let's talk",
    'aria-label="Pie de página"': 'aria-label="Footer"',
    '<h4>Explorar</h4>': '<h4>Explore</h4>',
    '<h4>Frentes</h4>': '<h4>Practice areas</h4>',
    'data-tab-link="0">Gestión forestal<': 'data-tab-link="0">Forest management<',
    'data-tab-link="1">Ambiente y territorio<': 'data-tab-link="1">Environment and land<',
    'data-tab-link="2">Ingeniería y obra<': 'data-tab-link="2">Engineering and construction<',
    'data-tab-link="3">Soporte en campo<': 'data-tab-link="3">Field support<',
    '· Del bosque a la obra</span>': '· From the forest to the build</span>',
    'Volver arriba': 'Back to top',
}


def main():
    html = SRC.read_text(encoding='utf-8')
    missing = []
    for es, en in HEAD:
        if es not in html:
            missing.append(es)
        html = html.replace(es, en)
    for es in sorted(TEXT, key=len, reverse=True):
        if es not in html:
            missing.append(es)
        html = html.replace(es, TEXT[es])
    if missing:
        print('Estos textos ya no están en index.html; actualice su traducción:', file=sys.stderr)
        for m in missing:
            print('  -', m[:90], file=sys.stderr)
        sys.exit(1)
    # rutas relativas: la página vive en /en/
    html = re.sub(r'(?<=["\s,])(media/|styles\.css|main\.js|icon\.svg|icon-180\.png)', r'../\1', html)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding='utf-8')
    print('OK ->', OUT.relative_to(ROOT))


if __name__ == '__main__':
    main()
