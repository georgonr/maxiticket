#!/usr/bin/env python3
import subprocess, uuid, os, sys

SCRATCH = os.path.dirname(os.path.abspath(__file__))
IMG_DIR = os.path.join(SCRATCH, 'demo_images')
os.makedirs(IMG_DIR, exist_ok=True)
SQL_PATH = os.path.join(SCRATCH, 'demo-events.sql')

ORG = 'cmppmvw7q000tct1erm6jf0tb'  # muckajur organizer

# Venues (reuse existing)
NU_SPIRIT = 'cmpsku8lq0001x5hikdejgx2s'   # Klub Nu Spirit, Bratislava
DIV_KE    = 'cmpsl7s9g0001899as1vuvcy1'   # Štátne divadlo Košice
TEHELNE   = 'cmpsl7t75000h899au1hea46r'   # Štadión Tehelné pole, Bratislava
TN_OPEN   = 'cmpsl7ttl000z899a2x4enmew'   # Trenčín Open Air
INCHEBA   = 'cmpsl7upz001f899aspqqd8iw'   # Incheba Expo, Bratislava
DK_ZA     = 'cmpsl7v82001t899akncvokki'   # Dom kultúry Žilina
NOVA_SC   = 'cmpsl7vvx0029899a62bgjfxs'   # Klub Nová scéna, Bratislava

# name, slug, category, keyword(loremflickr), venue, day_offset, capacity, description, tickets[(name,price,qty)]
SHOWS = [
  # ── Koncerty ──
  ("Rocková noc – Horkýže Slíže","rock-noc-horkyze-slize","Koncerty","rock,concert",NU_SPIRIT,17,600,
   "Legendárna slovenská kapela rozpáli klub energickou show plnou hitov.",[("Štandard",19,400),("VIP",35,80)]),
  ("Symfonický orchester: Filmová hudba","symfonicky-orchester-filmova-hudba","Koncerty","orchestra",DK_ZA,34,900,
   "Veľký orchester zahrá najkrajšie filmové soundtracky pod taktovkou dirigenta.",[("Štandard",22,700),("Balkón VIP",35,120)]),
  ("Jazz Club Live","jazz-club-live","Koncerty","jazz,music",NU_SPIRIT,10,180,
   "Intímny večer so špičkovými jazzovými muzikantmi a improvizáciou naživo.",[("Vstupenka",18,180)]),
  ("DJ Night: Electronic Vibes","dj-night-electronic-vibes","Koncerty","nightclub,dj",NU_SPIRIT,23,500,
   "Noc plná elektronickej hudby s poprednými DJ-mi a svetelnou show.",[("Štandard",15,400),("VIP pri bare",25,100)]),
  ("Detský koncert – Spievankovo","detsky-koncert-spievankovo","Koncerty","children,concert",DK_ZA,45,700,
   "Obľúbené detské pesničky naživo – zábavné popoludnie pre celú rodinu.",[("Dieťa",12,400),("Rodinný (2+2)",39,150)]),
  # ── Šport ──
  ("Hokej: Slovan vs. Košice","hokej-slovan-kosice","Šport","ice,hockey",TEHELNE,14,2000,
   "Prestížny extraligový zápas dvoch najväčších rivalov slovenského hokeja.",[("Tribúna",15,1600),("VIP",25,200)]),
  ("Basketbal – Final Four","basketbal-final-four","Šport","basketball,arena",TEHELNE,28,1800,
   "Vyvrcholenie basketbalovej sezóny – štyri najlepšie tímy v boji o titul.",[("Štandard",12,1500),("Parket VIP",20,150)]),
  ("Mestský maratón Bratislava","mestsky-maraton-bratislava","Šport","marathon,running",TEHELNE,60,3000,
   "Bež srdcom mesta – klasický maratón, polmaratón aj rodinný beh.",[("Registrácia",20,3000)]),
  ("Box Gala Night","box-gala-night","Šport","boxing,ring",INCHEBA,40,1200,
   "Galavečer profesionálneho boxu s domácimi aj zahraničnými zápasmi.",[("Štandard",18,1000),("Ring side VIP",25,120)]),
  # ── Divadlo ──
  ("Rómeo a Júlia","romeo-a-julia","Divadlo","theatre,stage",DIV_KE,21,500,
   "Nesmrteľná Shakespearova tragédia lásky v modernom naštudovaní.",[("Prízemie",16,350),("Balkón",24,150)]),
  ("Muzikál: Fantóm opery","muzikal-fantom-opery","Divadlo","musical,theatre",NOVA_SC,38,600,
   "Svetoznámy muzikál plný veľkolepej hudby, kostýmov a emócií.",[("Štandard",22,450),("Premiéra VIP",28,150)]),
  ("Detské divadlo: Janko Hraško","detske-divadlo-janko-hrasko","Divadlo","puppet,theatre",NOVA_SC,50,300,
   "Klasická rozprávka pre najmenších v bábkovom prevedení.",[("Vstupenka",12,300)]),
  ("Komédia: Testosterón","komedia-testosteron","Divadlo","comedy,stage",NOVA_SC,26,450,
   "Vtipná hra o mužoch, ženách a nedorozumeniach – zaručený smiech.",[("Štandard",18,350),("VIP rad",24,100)]),
  # ── Festivaly ──
  ("Letný festival Grape","letny-festival-grape","Festivaly","music,festival,crowd",TN_OPEN,90,5000,
   "Najväčší letný open-air festival – desiatky kapiel na viacerých pódiách.",[("1-dňový",39,4000),("Permanentka",65,1000)]),
  ("Food Truck Festival","food-truck-festival","Festivaly","street,food,festival",TN_OPEN,55,2500,
   "Gastro sviatok pod holým nebom – street food z celého sveta a hudba.",[("Vstupenka",25,2500)]),
  ("Filmový festival pod hviezdami","filmovy-festival-pod-hviezdami","Festivaly","cinema,outdoor",TN_OPEN,70,1500,
   "Letné kino pod otvorenou oblohou – tie najlepšie filmy pod hviezdami.",[("Vstupenka",25,1500)]),
  # ── Konferencie ──
  ("Startup Summit 2026","startup-summit-2026","Konferencie","conference,stage",INCHEBA,48,1000,
   "Najväčšie stretnutie startupov, investorov a inovátorov na Slovensku.",[("Early bird",49,500),("Štandard",89,500)]),
  ("Marketing Expo","marketing-expo","Konferencie","business,expo",INCHEBA,75,1200,
   "Konferencia o modernom marketingu s prednáškami špičkových odborníkov.",[("Vstupenka",59,1200)]),
  ("Zdravie & Wellness Konferencia","zdravie-wellness-konferencia","Konferencie","wellness,seminar",INCHEBA,110,800,
   "Deň venovaný zdravému životnému štýlu, výžive a duševnej pohode.",[("Vstupenka",45,800)]),
]

assert len(SHOWS) == 19, len(SHOWS)

def download(slug, keyword):
    dst = os.path.join(IMG_DIR, f'demo-{slug}.jpg')
    urls = [
        f'https://loremflickr.com/800/800/{keyword}',
        f'https://loremflickr.com/800/800/{keyword.split(",")[0]}',
        'https://picsum.photos/800',
    ]
    for attempt, url in enumerate(urls):
        for _ in range(2):
            subprocess.run(['curl','-s','-L','--max-time','25','-o',dst,url], check=False)
            if os.path.exists(dst) and os.path.getsize(dst) > 3000:
                with open(dst,'rb') as f:
                    magic = f.read(2)
                if magic == b'\xff\xd8':  # JPEG
                    return os.path.getsize(dst)
    return 0

def sql_lit(s):
    return "'" + s.replace("'", "''") + "'"

sql = ["BEGIN;"]
img_report = []
for name, slug, cat, kw, venue, day, cap, desc, tickets in SHOWS:
    size = download(slug, kw)
    img_report.append((slug, size))
    show_id = str(uuid.uuid4())
    termin_id = str(uuid.uuid4())
    img_id = str(uuid.uuid4())
    img_path = f'/v1/uploads/images/squares/demo-{slug}.jpg'
    starts = f"now() + interval '{day} days'"
    ends   = f"now() + interval '{day} days' + interval '3 hours'"
    saleend = f"now() + interval '{day-1} days'"
    sql.append(
      f"INSERT INTO \"Show\" (id,\"organizerId\",name,slug,description,category,status,\"isPromoted\",\"createdAt\",\"updatedAt\") "
      f"VALUES ('{show_id}','{ORG}',{sql_lit(name)},{sql_lit(slug)},{sql_lit(desc)},{sql_lit(cat)},'PUBLISHED',false,now(),now());"
    )
    sql.append(
      f"INSERT INTO \"Termin\" (id,\"showId\",\"venueId\",\"startsAt\",\"endsAt\",timezone,status,visible,capacity,mode,\"createdAt\",\"updatedAt\") "
      f"VALUES ('{termin_id}','{show_id}','{venue}',{starts},{ends},'Europe/Bratislava','ON_SALE',true,{cap},'GENERAL',now(),now());"
    )
    for i,(tname,price,qty) in enumerate(tickets):
        tt_id = str(uuid.uuid4())
        sql.append(
          f"INSERT INTO \"TicketType\" (id,\"terminId\",name,price,currency,\"totalQuantity\",\"maxPerOrder\",\"saleStartsAt\",\"saleEndsAt\",\"sortOrder\",\"isActive\",\"qrPaymentEnabled\",\"createdAt\",\"updatedAt\") "
          f"VALUES ('{tt_id}','{termin_id}',{sql_lit(tname)},{price},'EUR',{qty},10,now(),{saleend},{i},true,false,now(),now());"
        )
    sql.append(
      f"INSERT INTO \"ShowImage\" (id,\"showId\",url,\"thumbUrl\",\"squareUrl\",\"isCover\",\"sortOrder\",\"createdAt\",\"updatedAt\") "
      f"VALUES ('{img_id}','{show_id}',{sql_lit(img_path)},{sql_lit(img_path)},{sql_lit(img_path)},true,0,now(),now());"
    )
sql.append("COMMIT;")

with open(SQL_PATH,'w') as f:
    f.write("\n".join(sql) + "\n")

ok = sum(1 for _,s in img_report if s>0)
print(f"images downloaded ok: {ok}/19")
for slug,s in img_report:
    if s==0: print("  FAILED:", slug)
print("min size:", min(s for _,s in img_report), "max:", max(s for _,s in img_report))
print("SQL written:", SQL_PATH, "lines:", len(sql))
