# Generates the Zora Agent Lab artboards (.dc.html) and the canvas index.
# Look: warm ivory ground, indigo ink, coral accent (from the logo). Sora over IBM Plex Sans, Plex Mono for figures.
import json, datetime, html

INK="#1E1F4B"; INDIGO="#2B2D6E"; MUTED="#54567A"; LINE="#E3DDD2"; GROUND="#FBF8F3"; SURF="#FFFFFF"
CORAL="#FF6B4A"; CORALD="#B93A22"; TINT="#FFF1EC"; BLUE="#1F4FBF"; BLUET="#EAF0FF"; ORANGE="#B4500B"; ORANGET="#FFF3E3"; SOFT="#F3EEE5"
DISPLAY="'Sora', 'Trebuchet MS', sans-serif"; BODY="'IBM Plex Sans', 'Segoe UI', sans-serif"; MONO="'IBM Plex Mono', 'Consolas', monospace"

def page(title, w, h, body, script_vals="{}", props=None, ground=GROUND):
    p = {"accent":{"editor":"color","default":CORAL,"options":[CORAL,"#F2A541","#3A7CA5"]},"$preview":{"width":w,"height":h}}
    if props: p.update(props)
    dp = json.dumps(p).replace("&","&amp;").replace("'","&#39;")
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{html.escape(title)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
body{{margin:0;font-family:{BODY};color:{INK};background:{ground}}}
a{{color:{INDIGO}}}a:hover{{color:{CORALD}}}
</style>
</helmet>
<div style="width: {w}px; height: {h}px; box-sizing: border-box; background: {ground}; display: flex; flex-direction: column; font-family: {BODY}; color: {INK}">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{dp}'>
class Component extends DCLogic {{
renderVals() {{
return Object.assign({{ accent: this.props.accent ?? '{CORAL}' }}, {script_vals});
}}
}}
</script>
</body>
</html>
"""

def mark(size=28):
    return f"""<svg width="{size}" height="{size}" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="7" y="3" width="3" height="9" fill="{{{{accent}}}}"></rect><rect x="14.5" y="0" width="3" height="12" fill="{{{{accent}}}}"></rect><rect x="22" y="3" width="3" height="9" fill="{{{{accent}}}}"></rect><path d="M3 25a13 13 0 0 1 26 0z" fill="{INDIGO}"></path><rect x="3" y="27.5" width="26" height="3" fill="{{{{accent}}}}"></rect></svg>"""

def nav(active, pad=56):
    items=[("Find deals","Finder.dc.html"),("Price truth","PriceTruth.dc.html"),("Partner scorecard","Scorecard.dc.html")]
    links="".join(f"""<a href="{href}" style="text-decoration: none; font-weight: 500; font-size: 15px; padding: 12px 4px; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; color: {INK if n==active else MUTED}; border-bottom: 3px solid {'{{accent}}' if n==active else 'transparent'}">{n}</a>""" for n,href in items)
    return f"""<header style="display: flex; align-items: center; justify-content: space-between; padding: 14px {pad}px; background: {SURF}; border-bottom: 1px solid {LINE}">
<a href="Finder.dc.html" style="display: flex; align-items: center; gap: 12px; text-decoration: none; color: {INK}">{mark()}<span style="font-family: {DISPLAY}; font-weight: 700; font-size: 18px; letter-spacing: 0.02em">Zora Agent Lab</span></a>
<nav aria-label="Main" style="display: flex; align-items: center; gap: 28px">{links}</nav>
</header>"""

def sample_tag():
    return f"""<span style="font-family: {MONO}; font-size: 12px; padding: 4px 10px; border-radius: 999px; background: {SOFT}; color: {MUTED}; border: 1px dashed {MUTED}">Sample data</span>"""

def photo(w,h,label="Deal photo",radius=12):
    wh = f"width: {w}px; " if w else "width: 100%; "
    return f"""<div style="{wh}height: {h}px; border-radius: {radius}px; background: repeating-linear-gradient(135deg, {SOFT} 0 14px, #ECE5D8 14px 28px); display: flex; align-items: center; justify-content: center; color: {MUTED}; font-family: {MONO}; font-size: 12px">{label}</div>"""

def price_block(pay, lst, promo=None, big=30):
    out=f"""<div style="display: flex; flex-direction: column; gap: 8px">
<div style="display: flex; align-items: baseline; gap: 10px"><span style="font-size: 13px; color: {MUTED}">You pay</span><span style="font-family: {DISPLAY}; font-weight: 700; font-size: {big}px; color: {INK}">{pay}</span><span style="font-size: 14px; color: {MUTED}; text-decoration: line-through">{lst}</span></div>"""
    if promo:
        out+=f"""<div style="display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 10px; background: {TINT}; border: 1px solid #F6C9BC"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{CORALD}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0; margin-top: 2px"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"></path><circle cx="7.5" cy="7.5" r="1.5"></circle></svg><span style="font-size: 13px; line-height: 1.45; color: {INK}">{promo}</span></div>"""
    return out+"</div>"

def btn(label, href=None, kind="primary", wide=False):
    bg = INDIGO if kind=="primary" else SURF; fg = "#FFFFFF" if kind=="primary" else INK; bd = INDIGO if kind=="primary" else LINE
    w = "width: 100%; " if wide else ""
    style=f"{w}min-height: 48px; box-sizing: border-box; padding: 12px 22px; border-radius: 10px; border: 1px solid {bd}; background: {bg}; color: {fg}; font-family: {BODY}; font-weight: 600; font-size: 15px; display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; cursor: pointer"
    if href: return f"""<a href="{href}" style="{style}">{label}</a>"""
    return f"""<button type="button" style="{style}">{label}</button>"""

DEALS=[
 ("Swedish Massage at Foot Smile Spa","Chicago, IL","$49.00","$80.00","Type code SAVE20 at Groupon checkout to pay $39.20. Without it you pay $49.00."),
 ("Laser Hair Removal at Smooth Clinic","Chicago, IL","$99.00","$500.00",None),
 ("Full Synthetic Oil Change at Lakeview Auto","Chicago, IL","$44.99","$89.99","Type code AUTO20 at Groupon checkout to pay $35.99. Without it you pay $44.99."),
 ("Two Hours of Bowling for Four at Pin Palace","Chicago, IL","$39.00","$90.00",None),
 ("Pizza Dinner for Two at Nonna&#39;s","Chicago, IL","$29.00","$50.00",None),
 ("Deep Tissue Massage at Hudson Wellness","New York, NY","$59.00","$110.00",None),
]

def card(d, w=None):
    t,place,pay,lst,promo=d
    wh=f"width: {w}px; " if w else ""
    return f"""<article style="{wh}box-sizing: border-box; background: {SURF}; border: 1px solid {LINE}; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 14px">
{photo(None,150)}
<div style="display: flex; flex-direction: column; gap: 4px"><a href="Deal.dc.html" style="font-family: {DISPLAY}; font-weight: 600; font-size: 17px; line-height: 1.3; color: {INK}; text-decoration: none">{t}</a><span style="font-size: 13px; color: {MUTED}">{place}</span></div>
{price_block(pay,lst,promo,26)}
</article>"""

def field(label, value, w, idn, ph=""):
    return f"""<div style="display: flex; flex-direction: column; gap: 6px; width: {w}"><label for="{idn}" style="font-size: 13px; font-weight: 500; color: {MUTED}">{label}</label><input id="{idn}" type="text" value="{value}" placeholder="{ph}" style="min-height: 48px; box-sizing: border-box; padding: 10px 14px; border-radius: 10px; border: 1px solid {LINE}; background: {SURF}; font-family: {BODY}; font-size: 15px; color: {INK}; width: 100%"></div>"""

boards={}

# ---------------- Finder (desktop)
body=nav("Find deals")+f"""
<main style="padding: 48px 56px; display: flex; flex-direction: column; gap: 32px">
<div style="display: flex; flex-direction: column; gap: 10px; max-width: 760px"><h1 style="margin: 0; font-family: {DISPLAY}; font-weight: 700; font-size: 44px; line-height: 1.1; letter-spacing: -0.01em">Find a deal. See the price you pay.</h1><p style="margin: 0; font-size: 17px; line-height: 1.5; color: {MUTED}">Groupon deals, searched here. You pay on Groupon&#39;s own checkout.</p></div>
<form style="display: flex; align-items: flex-end; gap: 16px; padding: 20px; background: {SURF}; border: 1px solid {LINE}; border-radius: 16px">
{field("What are you looking for","massage","100%","q","massage, oil change, bowling")}
{field("City","Chicago","220px","city")}
{field("State","Illinois","200px","state")}
{field("Highest price","$60","160px","max")}
<div style="flex-shrink: 0">{btn("Search")}</div>
</form>
<div style="display: flex; align-items: center; justify-content: space-between"><h2 style="margin: 0; font-family: {DISPLAY}; font-weight: 600; font-size: 20px">6 deals in Chicago and nearby</h2>{sample_tag()}</div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px">
{''.join(card(d) for d in DEALS)}
</div>
</main>"""
boards["Finder.dc.html"]=("Deal finder",1280,1340,page("Deal finder",1280,1340,body))

# ---------------- Deal
opts=[("60-Minute Swedish Massage","$49.00","$80.00",True,True),("90-Minute Swedish Massage","$69.00","$120.00",False,True),("Couples Massage","$119.00","$200.00",False,False)]
def opt(o,i):
    t,p,l,sel,ok=o
    bd = INDIGO if sel else LINE
    note = "" if ok else f"""<span style="font-size: 12px; color: {MUTED}">Not available</span>"""
    return f"""<label for="opt{i}" style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; min-height: 48px; box-sizing: border-box; border-radius: 12px; border: 2px solid {bd}; background: {SURF}; opacity: {1 if ok else 0.55}"><input id="opt{i}" type="radio" name="option" {'checked' if sel else ''} {'disabled' if not ok else ''} style="width: 20px; height: 20px; accent-color: {INDIGO}"><span style="flex-grow: 1; font-weight: 500; font-size: 15px">{t}</span>{note}<span style="font-family: {MONO}; font-size: 13px; color: {MUTED}; text-decoration: line-through">{l}</span><span style="font-family: {DISPLAY}; font-weight: 700; font-size: 18px">{p}</span></label>"""
hist=[("28 Sep 2026","60-Minute Swedish Massage","Price you pay","$55.00","$49.00"),("21 Sep 2026","60-Minute Swedish Massage","Promo price","none","$39.20"),("14 Sep 2026","90-Minute Swedish Massage","Price you pay","$75.00","$69.00")]
def th(t,al="left"): return f"""<th scope="col" style="text-align: {al}; padding: 10px 12px; font-size: 12px; font-weight: 600; color: {MUTED}; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid {LINE}">{t}</th>"""
def td(t,al="left",mono=False,bold=False): return f"""<td style="text-align: {al}; padding: 12px; font-size: 14px; border-bottom: 1px solid {LINE}; font-family: {MONO if mono else BODY}; font-weight: {600 if bold else 400}">{t}</td>"""
rows="".join("<tr>"+td(a)+td(b)+td(c)+td(d,"right",True)+td(e,"right",True,True)+"</tr>" for a,b,c,d,e in hist)
body=nav("Find deals")+f"""
<main style="padding: 32px 56px 48px; display: flex; flex-direction: column; gap: 28px">
<nav aria-label="Path" style="display: flex; gap: 8px; font-size: 14px; color: {MUTED}"><a href="Finder.dc.html">Find deals</a><span>/</span><span>Swedish Massage at Foot Smile Spa</span></nav>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 40px">
<div style="display: flex; flex-direction: column; gap: 20px">
{photo(None,340,"Deal photo",16)}
<div style="display: flex; flex-direction: column; gap: 8px"><h1 style="margin: 0; font-family: {DISPLAY}; font-weight: 700; font-size: 32px; line-height: 1.2">Swedish Massage at Foot Smile Spa</h1><p style="margin: 0; font-size: 16px; line-height: 1.55; color: {MUTED}">A 60 or 90 minute Swedish massage that eases sore muscles.</p></div>
<div style="display: flex; flex-direction: column; gap: 6px"><h2 style="margin: 0; font-family: {DISPLAY}; font-weight: 600; font-size: 16px">Where</h2><p style="margin: 0; font-size: 15px; line-height: 1.5">Foot Smile Spa, 100 Main St, Chicago, IL 60611</p></div>
<div style="display: flex; flex-direction: column; gap: 6px"><h2 style="margin: 0; font-family: {DISPLAY}; font-weight: 600; font-size: 16px">Good to know</h2><p style="margin: 0; font-size: 15px; line-height: 1.5; color: {MUTED}">Valid for new and returning customers. Appointment required.</p></div>
</div>
<div style="display: flex; flex-direction: column; gap: 20px; padding: 24px; background: {SURF}; border: 1px solid {LINE}; border-radius: 16px; align-self: flex-start">
<div style="display: flex; align-items: center; justify-content: space-between"><h2 style="margin: 0; font-family: {DISPLAY}; font-weight: 600; font-size: 18px">Choose an option</h2>{sample_tag()}</div>
<div style="display: flex; flex-direction: column; gap: 10px">{''.join(opt(o,i) for i,o in enumerate(opts))}</div>
{price_block("$49.00","$80.00","Type code SAVE20 at Groupon checkout to pay $39.20. Without it you pay $49.00.",36)}
{btn("Get checkout link","Checkout.dc.html","primary",True)}
<p style="margin: 0; font-size: 13px; line-height: 1.5; color: {MUTED}">You pay on Groupon&#39;s checkout page. Groupon sends the voucher.</p>
</div>
</div>
<section style="display: flex; flex-direction: column; gap: 12px"><h2 style="margin: 0; font-family: {DISPLAY}; font-weight: 600; font-size: 20px">Price history</h2>
<table style="width: 100%; border-collapse: collapse; background: {SURF}; border: 1px solid {LINE}; border-radius: 12px"><thead><tr>{th("Seen on")}{th("Option")}{th("What changed")}{th("From","right")}{th("To","right")}</tr></thead><tbody>{rows}</tbody></table></section>
</main>"""
boards["Deal.dc.html"]=("Deal page",1280,1260,page("Deal page",1280,1260,body))

# ---------------- Checkout hand-off
body=nav("Find deals")+f"""
<main style="padding: 56px; display: flex; justify-content: center">
<div style="width: 640px; display: flex; flex-direction: column; gap: 24px">
<div style="display: flex; flex-direction: column; gap: 8px"><h1 style="margin: 0; font-family: {DISPLAY}; font-weight: 700; font-size: 36px; line-height: 1.15">Ready to pay at Groupon</h1><p style="margin: 0; font-size: 16px; color: {MUTED}">Your cart is saved. The next page is Groupon&#39;s checkout.</p></div>
<div style="background: {SURF}; border: 1px solid {LINE}; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; gap: 16px">
<div style="display: flex; align-items: center; gap: 16px">{photo(88,64,"Photo",10)}<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-weight: 600; font-size: 16px">Swedish Massage at Foot Smile Spa</span><span style="font-size: 14px; color: {MUTED}">60-Minute Swedish Massage · 1 voucher</span></div><span style="font-family: {DISPLAY}; font-weight: 700; font-size: 18px">$49.00</span></div>
<div style="height: 1px; background: {LINE}"></div>
<div style="display: flex; align-items: baseline; justify-content: space-between"><span style="font-size: 15px; color: {MUTED}">Total before tax</span><span style="font-family: {DISPLAY}; font-weight: 700; font-size: 30px">$49.00</span></div>
{price_block("$49.00","$80.00","Type code SAVE20 at Groupon checkout to pay $39.20. Without it you pay $49.00.",0).split('</div>',1)[1].rsplit('</div>',1)[0]}
</div>
{btn("Buy now at Groupon","Return.dc.html","primary",True)}
<div style="display: flex; align-items: center; justify-content: space-between"><a href="Deal.dc.html" style="font-size: 14px; min-height: 44px; display: flex; align-items: center">Back to the deal</a>{sample_tag()}</div>
</div>
</main>"""
boards["Checkout.dc.html"]=("Checkout hand-off",1280,820,page("Checkout hand-off",1280,820,body))

# ---------------- Checkout: price changed
body=nav("Find deals")+f"""
<main style="padding: 56px; display: flex; justify-content: center">
<div style="width: 640px; display: flex; flex-direction: column; gap: 24px">
<div style="display: flex; gap: 14px; align-items: flex-start; padding: 20px; border-radius: 16px; background: {ORANGET}; border: 1px solid #F1C58F"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="{ORANGE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0"><path d="M12 3 2 20h20z"></path><path d="M12 10v4"></path><path d="M12 17v.5"></path></svg><div style="display: flex; flex-direction: column; gap: 6px"><h1 style="margin: 0; font-family: {DISPLAY}; font-weight: 700; font-size: 26px; line-height: 1.2">The price changed</h1><p style="margin: 0; font-size: 15px; line-height: 1.5">Groupon changed the price while you were looking. No cart was made.</p></div></div>
<div style="background: {SURF}; border: 1px solid {LINE}; border-radius: 16px; padding: 24px; display: flex; align-items: center; justify-content: space-between; gap: 24px"><div style="display: flex; flex-direction: column; gap: 2px"><span style="font-weight: 600; font-size: 16px">Swedish Massage at Foot Smile Spa</span><span style="font-size: 14px; color: {MUTED}">60-Minute Swedish Massage</span></div><div style="display: flex; align-items: baseline; gap: 12px"><span style="font-family: {MONO}; font-size: 15px; color: {MUTED}; text-decoration: line-through">$49.00</span><span style="font-family: {DISPLAY}; font-weight: 700; font-size: 28px">$52.00</span></div></div>
<div style="display: flex; gap: 12px">{btn("Continue at $52.00","Checkout.dc.html")}{btn("Back to the deal","Deal.dc.html","secondary")}</div>
</div>
</main>"""
boards["CheckoutPriceChanged.dc.html"]=("Checkout: price changed",1280,560,page("Checkout, price changed",1280,560,body))

# ---------------- Return (confirmed)
def voucher(n): return f"""<div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; border-radius: 12px; background: {GROUND}; border: 1px solid {LINE}"><div style="display: flex; flex-direction: column; gap: 2px"><span style="font-weight: 500; font-size: 15px">Voucher {n}</span><span style="font-size: 13px; color: {MUTED}">Confirmed</span></div>{btn("View on Groupon","https://www.groupon.com/mygroupons","secondary")}</div>"""
body=nav("Find deals")+f"""
<main style="padding: 56px; display: flex; justify-content: center">
<div style="width: 680px; display: flex; flex-direction: column; gap: 24px">
<div style="display: flex; align-items: center; gap: 16px"><svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="{BLUET}"></circle><path d="m15 24.5 6 6 12-13" stroke="{BLUE}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"></path></svg><div style="display: flex; flex-direction: column; gap: 4px"><h1 style="margin: 0; font-family: {DISPLAY}; font-weight: 700; font-size: 36px; line-height: 1.1">Thank you</h1><p style="margin: 0; font-size: 16px; color: {MUTED}">Groupon confirmed your order.</p></div></div>
<div style="background: {SURF}; border: 1px solid {LINE}; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; gap: 16px">
<div style="display: flex; align-items: center; justify-content: space-between"><div style="display: flex; flex-direction: column; gap: 2px"><span style="font-weight: 600; font-size: 16px">Swedish Massage at Foot Smile Spa</span><span style="font-size: 14px; color: {MUTED}">60-Minute Swedish Massage · 2 vouchers</span></div>{sample_tag()}</div>
<div style="display: flex; flex-direction: column; gap: 10px">{voucher(1)}{voucher(2)}</div>
</div>
<p style="margin: 0; font-size: 14px; line-height: 1.5; color: {MUTED}">Order <span style="font-family: {MONO}">3f2b8c1e-7d4a-4b9f-8e2d-1a2b3c4d5e6f</span>. Groupon also sent a confirmation email.</p>
</div>
</main>"""
boards["Return.dc.html"]=("After payment: confirmed",1280,720,page("After payment",1280,720,body))

# ---------------- Login
body=f"""<main style="flex-grow: 1; display: flex; align-items: center; justify-content: center; padding: 48px">
<form style="width: 400px; box-sizing: border-box; background: {SURF}; border: 1px solid {LINE}; border-radius: 20px; padding: 36px; display: flex; flex-direction: column; gap: 20px">
<div style="display: flex; align-items: center; gap: 12px">{mark(36)}<span style="font-family: {DISPLAY}; font-weight: 700; font-size: 20px; letter-spacing: 0.02em">Zora Agent Lab</span></div>
<div style="display: flex; flex-direction: column; gap: 6px"><h1 style="margin: 0; font-family: {DISPLAY}; font-weight: 700; font-size: 26px">This lab is private</h1><p style="margin: 0; font-size: 15px; line-height: 1.5; color: {MUTED}">Enter the PIN you were given.</p></div>
<div style="display: flex; flex-direction: column; gap: 6px"><label for="pin" style="font-size: 13px; font-weight: 500; color: {MUTED}">PIN</label><input id="pin" type="password" value="" autocomplete="one-time-code" style="min-height: 52px; box-sizing: border-box; padding: 10px 14px; border-radius: 10px; border: 1px solid {LINE}; font-family: {MONO}; font-size: 20px; letter-spacing: 0.3em; color: {INK}; width: 100%"></div>
{btn("Open",None,"primary",True)}
</form>
</main>"""
boards["Login.dc.html"]=("PIN login",1280,720,page("PIN login",1280,720,body))

# ---------------- Price truth
def kpi(label,value,sub):
    return f"""<div style="background: {SURF}; border: 1px solid {LINE}; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 6px"><span style="font-size: 13px; font-weight: 500; color: {MUTED}">{label}</span><span style="font-family: {DISPLAY}; font-weight: 700; font-size: 34px; line-height: 1.1">{value}</span><span style="font-size: 13px; line-height: 1.4; color: {MUTED}">{sub}</span></div>"""
hist_bars=[("0 to 5%",18),("5 to 10%",42),("10 to 15%",96),("15 to 20%",150),("20 to 25%",118),("25 to 30%",54),("over 30%",22)]
def hbar(l,v,mx=150): return f"""<div style="display: flex; align-items: center; gap: 12px"><span style="width: 96px; font-size: 13px; color: {MUTED}">{l}</span><div style="flex-grow: 1; height: 22px; background: {SOFT}; border-radius: 6px"><div style="width: {round(v/mx*100)}%; height: 22px; background: {INDIGO}; border-radius: 6px"></div></div><span style="width: 44px; text-align: right; font-family: {MONO}; font-size: 13px">{v}</span></div>"""
worst=[("Hydrafacial at Glow Studio","$99.00","$84.15","15.0%","GLOW15"),("Swedish Massage at Foot Smile Spa","$49.00","$39.20","20.0%","SAVE20"),("Full Synthetic Oil Change at Lakeview Auto","$44.99","$35.99","20.0%","AUTO20"),("Ten Yoga Classes at Sunrise Yoga","$45.00","$36.00","20.0%","no code")]
wrows="".join("<tr>"+td(a)+td(b,"right",True)+td(c,"right",True)+td(d,"right",True,True)+td(e,"left",True)+"</tr>" for a,b,c,d,e in worst)
days=[("2026-10-05",20,19,1,0,0),("2026-10-04",20,20,0,0,0),("2026-10-03",20,18,1,1,0)]
drows="".join("<tr>"+td(a,"left",True)+td(b,"right",True)+td(c,"right",True)+td(d,"right",True,True)+td(e,"right",True)+td(f,"right",True)+"</tr>" for a,b,c,d,e,f in days)
def panel(title, inner, note=""):
    n = f"""<p style="margin: 0; font-size: 13px; line-height: 1.45; color: {MUTED}">{note}</p>""" if note else ""
    return f"""<section style="background: {SURF}; border: 1px solid {LINE}; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; gap: 16px"><div style="display: flex; flex-direction: column; gap: 4px"><h2 style="margin: 0; font-family: {DISPLAY}; font-weight: 600; font-size: 18px">{title}</h2>{n}</div>{inner}</section>"""
def table(head, rows): return f"""<table style="width: 100%; border-collapse: collapse"><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table>"""
stack=f"""<div style="display: flex; flex-direction: column; gap: 12px"><div style="display: flex; height: 28px; border-radius: 8px; overflow: hidden"><div style="width: 71%; background: {INDIGO}"></div><div style="width: 24%; background: {CORAL}"></div><div style="width: 5%; background: #B9B4C9"></div></div><div style="display: flex; gap: 24px; font-size: 13px"><span style="display: flex; align-items: center; gap: 8px"><span style="width: 12px; height: 12px; border-radius: 3px; background: {INDIGO}"></span>Shows the price you pay: 71%</span><span style="display: flex; align-items: center; gap: 8px"><span style="width: 12px; height: 12px; border-radius: 3px; background: {CORAL}"></span>Shows the promo price: 24%</span><span style="display: flex; align-items: center; gap: 8px"><span style="width: 12px; height: 12px; border-radius: 3px; background: #B9B4C9"></span>Shows another price: 5%</span></div></div>"""
body=nav("Price truth")+f"""
<main style="padding: 40px 56px 56px; display: flex; flex-direction: column; gap: 28px">
<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 24px"><div style="display: flex; flex-direction: column; gap: 8px; max-width: 780px"><h1 style="margin: 0; font-family: {DISPLAY}; font-weight: 700; font-size: 38px; line-height: 1.15">Price truth</h1><p style="margin: 0; font-size: 16px; line-height: 1.5; color: {MUTED}">Partners receive a promo price. Checkout charges the higher price unless the shopper types the code. This page measures that gap.</p></div>{sample_tag()}</div>
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px">
{kpi("Options with a promo price","38%","500 of 1,316 options on sale")}
{kpi("Typical gap","18.5%","Half of the promo options differ by more")}
{kpi("Gap at the 90th percentile","27.0%","One in ten differs by more")}
{kpi("Cart price equals catalogue price","95%","57 of 60 sampled carts, last 3 days")}
</div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px">
{panel("How large is the gap", '<div style="display: flex; flex-direction: column; gap: 10px">'+''.join(hbar(l,v) for l,v in hist_bars)+'</div>', "Options by the share a shopper overpays without the code.")}
{panel("Which price does groupon.com show", stack, "Listing pages on groupon.com compared with the partner catalogue, 412 matched deals.")}
</div>
{panel("Largest gaps", table(th("Deal")+th("You pay","right")+th("With code","right")+th("Gap","right")+th("Code"), wrows))}
{panel("Cart sample by day", table(th("Day")+th("Sampled","right")+th("Same price","right")+th("Price changed","right")+th("Not available","right")+th("Errors","right"), drows), "Twenty carts a day, each created with the catalogue price and abandoned at once.")}
</main>"""
boards["PriceTruth.dc.html"]=("Price truth dashboard",1280,1560,page("Price truth",1280,1560,body))

# ---------------- Scorecard
def chip(kind):
    m={"pass":(BLUET,BLUE,"Pass",'<path d="m5 12.5 4.5 4.5L19 7.5"></path>'),"fail":(ORANGET,ORANGE,"Fail",'<path d="M6 6l12 12"></path><path d="M18 6 6 18"></path>'),"skip":(SOFT,MUTED,"Skipped",'<path d="M6 12h12"></path>')}[kind]
    return f"""<span style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: {m[0]}; color: {m[1]}; font-size: 13px; font-weight: 600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="{m[1]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{m[3]}</svg>{m[2]}</span>"""
checks=[("Contract file unchanged","pass","openapi.json has the stored hash"),("Guide version unchanged","pass","Version 7"),("Registration reads back","pass","Zora Agent Lab, active"),("Catalogue first page","pass","10 products, matches the schema"),("Catalogue walk","pass","3 pages, cursors accepted"),("Catalogue delta","pass","12 products changed since the last run"),("Refusals","fail","Expected FORBIDDEN for a state outside the list, got an empty page"),("Cart lifecycle","pass","Create, add, change, read, remove, abandon"),("Price mismatch","pass","PRICE_MISMATCH came with the current price"),("Checkout link","pass","partner.groupon.com answered 200"),("Order read","skip","No test order yet")]
def check_row(c):
    return f"""<div style="display: flex; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid {LINE}"><span style="width: 250px; font-weight: 500; font-size: 15px">{c[0]}</span><span style="width: 110px; display: flex">{chip(c[1])}</span><span style="flex-grow: 1; font-size: 14px; color: {MUTED}">{c[2]}</span></div>"""
lat=[("List products","412 ms","980 ms"),("Create cart","655 ms","1,420 ms"),("Read cart","298 ms","610 ms"),("Read registration","187 ms","402 ms")]
lrows="".join("<tr>"+td(a)+td(b,"right",True)+td(c,"right",True)+"</tr>" for a,b,c in lat)
finds=[("Major","Page size","The guide says pages default to 100. The contract file recommends 10.","Walk with 50 and step down on a timeout."),("Major","Search","The bet plan expects search through the partner interface.","The guide says there is no search endpoint."),("Minor","Errors","HTTP status would tell a failure from a success.","Products, Supplier and Booking answer every error as HTTP 400.")]
def finding(f):
    col = ORANGE if f[0]=="Major" else MUTED; bg = ORANGET if f[0]=="Major" else SOFT
    return f"""<div style="display: flex; gap: 16px; padding: 16px; border-radius: 12px; background: {GROUND}; border: 1px solid {LINE}"><span style="align-self: flex-start; padding: 4px 10px; border-radius: 999px; background: {bg}; color: {col}; font-size: 12px; font-weight: 600">{f[0]}</span><div style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px"><span style="font-weight: 600; font-size: 15px">{f[1]}</span><span style="font-size: 14px; line-height: 1.45"><span style="color: {MUTED}">Expected: </span>{f[2]}</span><span style="font-size: 14px; line-height: 1.45"><span style="color: {MUTED}">Observed: </span>{f[3]}</span></div></div>"""
body=nav("Partner scorecard")+f"""
<main style="padding: 40px 56px 56px; display: flex; flex-direction: column; gap: 28px">
<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 24px"><div style="display: flex; flex-direction: column; gap: 8px; max-width: 780px"><h1 style="margin: 0; font-family: {DISPLAY}; font-weight: 700; font-size: 38px; line-height: 1.15">Partner experience</h1><p style="margin: 0; font-size: 16px; line-height: 1.5; color: {MUTED}">Every day at 04:00 UTC the lab walks the partner journey against production, as an outside builder would.</p></div>{sample_tag()}</div>
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px">
{kpi("Latest run","9 of 11","One check failed, one skipped")}
{kpi("Pass rate, 7 days","94%","72 of 77 checks")}
{kpi("Catalogue copy","57,204","deals, 41,880 on sale")}
{kpi("Guide to first checkout link","47 min","Measured once, on registration day")}
</div>
{panel("Latest run, 5 October 2026", '<div style="display: flex; flex-direction: column">'+''.join(check_row(c) for c in checks)+'</div>')}
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px">
{panel("Response time", table(th("Call")+th("Typical","right")+th("Slow (95th)","right"), lrows), "Seven days of probe runs.")}
{panel("Changes to the contract", f'<div style="display: flex; flex-direction: column; gap: 10px"><div style="display: flex; justify-content: space-between; font-size: 14px"><span>Guide</span><span style="font-family: {MONO}">version 7, unchanged</span></div><div style="display: flex; justify-content: space-between; font-size: 14px"><span>Contract file</span><span style="font-family: {MONO}">v003, unchanged</span></div><div style="display: flex; justify-content: space-between; font-size: 14px"><span>Old addresses under /octo/v1/</span><span style="font-family: {MONO}">end 31 March 2027</span></div></div>', "The probe compares the guide and the contract file with yesterday.")}
</div>
{panel("What stopped us, and what the guide did not say", '<div style="display: flex; flex-direction: column; gap: 12px">'+''.join(finding(f) for f in finds)+'</div>')}
</main>"""
boards["Scorecard.dc.html"]=("Partner scorecard",1280,1860,page("Partner scorecard",1280,1860,body))

# ---------------- phone: finder
def pnav():
    return f"""<header style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: {SURF}; border-bottom: 1px solid {LINE}"><a href="FinderPhone.dc.html" style="display: flex; align-items: center; gap: 10px; text-decoration: none; color: {INK}; min-height: 44px">{mark(26)}<span style="font-family: {DISPLAY}; font-weight: 700; font-size: 16px">Zora Agent Lab</span></a><button type="button" aria-label="Open menu" style="width: 44px; height: 44px; border: 1px solid {LINE}; border-radius: 10px; background: {SURF}; display: flex; align-items: center; justify-content: center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="{INK}" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path></svg></button></header>"""
body=pnav()+f"""
<main style="padding: 24px 16px 32px; display: flex; flex-direction: column; gap: 20px">
<h1 style="margin: 0; font-family: {DISPLAY}; font-weight: 700; font-size: 28px; line-height: 1.15">Find a deal. See the price you pay.</h1>
<form style="display: flex; flex-direction: column; gap: 12px; padding: 16px; background: {SURF}; border: 1px solid {LINE}; border-radius: 16px">
{field("What are you looking for","massage","100%","pq")}
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">{field("City","Chicago","100%","pcity")}{field("Highest price","$60","100%","pmax")}</div>
{btn("Search",None,"primary",True)}
</form>
<div style="display: flex; align-items: center; justify-content: space-between"><h2 style="margin: 0; font-family: {DISPLAY}; font-weight: 600; font-size: 17px">6 deals in Chicago</h2>{sample_tag()}</div>
<div style="display: flex; flex-direction: column; gap: 16px">{card(DEALS[0])}{card(DEALS[1])}</div>
</main>"""
boards["FinderPhone.dc.html"]=("Deal finder, phone",390,1360,page("Deal finder, phone",390,1360,body))

# ---------------- phone: return waiting
body=pnav()+f"""
<main style="flex-grow: 1; padding: 32px 16px; display: flex; flex-direction: column; gap: 20px">
<div style="display: flex; flex-direction: column; gap: 8px"><h1 style="margin: 0; font-family: {DISPLAY}; font-weight: 700; font-size: 30px; line-height: 1.15">Thank you</h1><p style="margin: 0; font-size: 16px; line-height: 1.5; color: {MUTED}">Groupon is confirming your order. This takes a few seconds.</p></div>
<div role="status" style="background: {SURF}; border: 1px solid {LINE}; border-radius: 16px; padding: 20px; display: flex; align-items: center; gap: 14px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="{INDIGO}" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" ></path></svg><div style="display: flex; flex-direction: column; gap: 2px"><span style="font-weight: 600; font-size: 15px">Checking with Groupon</span><span style="font-size: 13px; color: {MUTED}">Your vouchers appear here.</span></div></div>
<p style="margin: 0; font-size: 14px; line-height: 1.5; color: {MUTED}">Groupon also sends a confirmation email with your voucher.</p>
</main>"""
boards["ReturnWaitingPhone.dc.html"]=("After payment: waiting, phone",390,844,page("After payment, waiting",390,844,body))

# ---------------- layout
rows_layout=[["Finder.dc.html","Deal.dc.html","Checkout.dc.html","CheckoutPriceChanged.dc.html","Return.dc.html"],["PriceTruth.dc.html","Scorecard.dc.html","Login.dc.html"],["FinderPhone.dc.html","ReturnWaitingPhone.dc.html"]]
index={"v":3,"createdOnFiles":{"v":1,"at":datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")},"title":"Zora Agent Lab","launch":{"view":"canvas"},"pages":[],"boards":{},"order":[],"notes":{},"designSystems":[]}
y=0
titles=["Shopper journey","Dashboards and login","Phone"]
for ri,row in enumerate(rows_layout):
    x=0; mh=0
    roww=sum(boards[n][1] for n in row)+80*(len(row)-1)
    index["notes"][f"row{ri}"]={"x":0,"y":y-300,"text":titles[ri],"kind":"title1","maxW":roww}
    for n in row:
        t,w,h,src=boards[n]
        index["boards"][n]={"x":x,"y":y,"w":w,"h":h,"title":t}
        index["order"].append(n)
        open(f"project/{n}","w").write(src)
        x+=w+80; mh=max(mh,h)
    y+=mh+120+340
# Main entry: the first artboard must be named Main.dc.html
import os
os.rename("project/Finder.dc.html","project/Main.dc.html")
def ren(s): return s.replace("Finder.dc.html","Main.dc.html")
index["boards"]={ren(k) if k=="Finder.dc.html" else k:v for k,v in index["boards"].items()}
index["order"]=[ren(k) if k=="Finder.dc.html" else k for k in index["order"]]
for f in os.listdir("project"):
    if f.endswith(".dc.html"):
        s=open(f"project/{f}").read().replace('href="Finder.dc.html"','href="Main.dc.html"')
        open(f"project/{f}","w").write(s)
json.dump(index,open("project/canvas.json","w"),indent=1)
print(json.dumps(index["boards"],indent=0)[:900]); print(sorted(os.listdir("project")))
