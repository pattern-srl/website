from pathlib import Path
from functools import lru_cache
from datetime import datetime, timezone
import json
from PIL import Image, ImageCms
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, ContentStream, DecodedStreamObject, DictionaryObject, FloatObject, NameObject, NumberObject, RectangleObject, TextStringObject

ROOT=Path(r'C:/Users/Matteo/website')
SOURCE=ROOT/'tmp/pdfs/card-rgb.pdf'
OUTPUT=ROOT/'output/pdf/pattern-matteo-lauriola-stampa.pdf'
PROFILE=Path(r'C:/Windows/System32/spool/drivers/color/CoatedFOGRA39.icc')
MM=72/25.4

srgb=ImageCms.createProfile('sRGB')
cmyk=ImageCms.getOpenProfile(str(PROFILE))
transform=ImageCms.buildTransformFromOpenProfiles(srgb,cmyk,'RGB','CMYK',renderingIntent=1,flags=ImageCms.Flags.BLACKPOINTCOMPENSATION)

@lru_cache(maxsize=128)
def convert(rgb):
    rgb=tuple(max(0,min(255,int(round(float(c)*255)))) for c in rgb)
    pixel=ImageCms.applyTransform(Image.new('RGB',(1,1),rgb),transform).getpixel((0,0))
    return [FloatObject(v/255) for v in pixel]

reader=PdfReader(str(SOURCE))
writer=PdfWriter()
writer.clone_document_from_reader(reader)
writer.pdf_header='%PDF-1.6'
counts={'rgb_to_cmyk':0,'text_black':0,'forms':0}
visited=set()

def rewrite(stream):
    parsed=ContentStream(stream,writer)
    rewritten=[]
    fill=(0.0,0.0,0.0)
    stack=[]
    for operands,op in parsed.operations:
        if op==b'q': stack.append(fill)
        elif op==b'Q' and stack: fill=stack.pop()
        if op in (b'rg',b'RG'):
            rgb=tuple(float(v) for v in operands)
            if op==b'rg': fill=rgb
            operands=convert(rgb)
            op=b'k' if op==b'rg' else b'K'
            counts['rgb_to_cmyk']+=1
        elif op in (b'g',b'G'):
            gray=float(operands[0])
            if op==b'g': fill=(gray,gray,gray)
            operands=[FloatObject(0),FloatObject(0),FloatObject(0),FloatObject(1-gray)]
            op=b'k' if op==b'g' else b'K'
        elif op==b'BT' and max(fill)<0.6:
            # Small type uses a single black plate, while the large background
            # and logo paths retain the profile-converted brand colours.
            black=1.0 if max(fill)<0.25 else 0.72
            rewritten.append(([FloatObject(0),FloatObject(0),FloatObject(0),FloatObject(black)],b'k'))
            counts['text_black']+=1
        rewritten.append((operands,op))
        if op==b'ET': rewritten.append((convert(fill),b'k'))
    parsed.operations=rewritten
    return parsed

def resources(resource):
    if not resource: return
    resource=resource.get_object()
    for ref in resource.get('/XObject',{}).get_object().values() if '/XObject' in resource else []:
        obj=ref.get_object()
        identity=id(obj)
        if identity in visited: continue
        visited.add(identity)
        if obj.get('/Subtype')=='/Form':
            new=rewrite(obj)
            obj.set_data(new.get_data())
            counts['forms']+=1
            resources(obj.get('/Resources'))

for page in writer.pages:
    resources(page.get('/Resources'))
    page[NameObject('/Contents')]=writer._add_object(rewrite(page.get_contents()))
    page.mediabox=RectangleObject([0,0,91*MM,61*MM])
    page.bleedbox=RectangleObject([0,0,91*MM,61*MM])
    page.trimbox=RectangleObject([3*MM,3*MM,88*MM,58*MM])
    page.cropbox=RectangleObject([0,0,91*MM,61*MM])
    page.pop('/Annots',None)

icc=DecodedStreamObject()
icc.set_data(PROFILE.read_bytes())
icc[NameObject('/N')]=NumberObject(4)
icc[NameObject('/Alternate')]=NameObject('/DeviceCMYK')
intent=DictionaryObject({
    NameObject('/Type'):NameObject('/OutputIntent'),
    NameObject('/S'):NameObject('/GTS_PDFX'),
    NameObject('/OutputConditionIdentifier'):TextStringObject('FOGRA39'),
    NameObject('/OutputCondition'):TextStringObject('Coated FOGRA39 (ISO 12647-2:2004)'),
    NameObject('/RegistryName'):TextStringObject('http://www.color.org'),
    NameObject('/Info'):TextStringObject('Coated FOGRA39; coated stock; 3 mm bleed'),
    NameObject('/DestOutputProfile'):writer._add_object(icc),
})
writer.root_object[NameObject('/OutputIntents')]=ArrayObject([writer._add_object(intent)])
writer.add_metadata({
    '/Title':'Pattern - Matteo Lauriola - Biglietto da visita',
    '/Author':'Pattern',
    '/Subject':'Fronte e retro; taglio 85 x 55 mm; abbondanza 3 mm; CMYK Coated FOGRA39',
    '/Creator':'Pattern business card design',
    '/CreationDate':datetime.now(timezone.utc).strftime("D:%Y%m%d%H%M%S+00'00'"),
})
OUTPUT.parent.mkdir(parents=True,exist_ok=True)
writer.write(str(OUTPUT))

result=PdfReader(str(OUTPUT))
fonts=[]
allops=[]
seen=set()
image_count=0
def inspect_res(res):
    global image_count
    if not res: return
    res=res.get_object()
    if '/Font' in res:
        for ref in res['/Font'].get_object().values():
            font=ref.get_object()
            for descendant in font.get('/DescendantFonts',[font]):
                f=descendant.get_object()
                desc=f.get('/FontDescriptor')
                if desc:
                    desc=desc.get_object()
                    fonts.append({'name':str(f.get('/BaseFont')),'embedded':any(k in desc for k in ['/FontFile','/FontFile2','/FontFile3'])})
    if '/XObject' in res:
        for ref in res['/XObject'].get_object().values():
            obj=ref.get_object()
            if id(obj) in seen: continue
            seen.add(id(obj))
            if obj.get('/Subtype')=='/Image': image_count+=1
            if obj.get('/Subtype')=='/Form':
                allops.extend(op for _,op in ContentStream(obj,result).operations)
                inspect_res(obj.get('/Resources'))
for page in result.pages:
    allops.extend(op for _,op in ContentStream(page.get_contents(),result).operations)
    inspect_res(page.get('/Resources'))
assert len(result.pages)==2
assert fonts and all(f['embedded'] for f in fonts)
assert not any(op in (b'rg',b'RG',b'g',b'G') for op in allops)
assert image_count==0
text='\n'.join(page.extract_text() for page in result.pages)
for required in ['Matteo','Lauriola','Co-founder','Software Engineering','+39 324 871 6326','matteo@findpattern.it','findpattern.it']:
    assert required in text,required
print(json.dumps({'output':str(OUTPUT),'pages':len(result.pages),'media_mm':[91,61],'trim_mm':[85,55],'bleed_mm':3,'profile':'Coated FOGRA39','fonts':fonts,'raster_images':image_count,'conversion':counts,'bytes':OUTPUT.stat().st_size},ensure_ascii=False))
