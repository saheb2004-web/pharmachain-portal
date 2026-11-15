import argparse
import sys
import time

import requests

p = argparse.ArgumentParser()
p.add_argument("--api", default="http://127.0.0.1:5000")
p.add_argument("--portal", default="http://127.0.0.1:8000")
p.add_argument("--genuine", help="path to a genuine packaging photo (optional)")
p.add_argument("--fake", help="path to a counterfeit packaging photo (optional)")
a = p.parse_args()

results = []


def check(name, ok, detail=""):
    results.append(ok)
    print("%-52s %s %s" % (name, "PASS" if ok else "FAIL", "" if ok else detail))


def get(url):
    return requests.get(url, timeout=30)


def post(path, **kw):
    return requests.post(a.api + path, timeout=60, **kw)


try:
    health = get(a.api + "/health").json()
except requests.exceptions.ConnectionError:
    sys.exit("Backend not reachable at %s. Start the node, deploy, and run app.py first." % a.api)

check("1. Backend connected to the blockchain", health.get("connected") is True, str(health))

batch = "ITEST-%d" % int(time.time())

r = post(
    "/register-batch",
    json={"batch_id": batch, "drug_name": "Vaccine X", "location": "Factory, Kolkata"},
)
check("2. Register a batch", r.json().get("ok") is True, r.text)

r = post(
    "/transfer-custody",
    json={"batch_id": batch, "new_holder": "distributor", "location": "Warehouse, Howrah"},
)
check("3. Transfer to distributor", r.json().get("ok") is True, r.text)

r = post(
    "/transfer-custody",
    json={"batch_id": batch, "new_holder": "pharmacy", "location": "Pharmacy, Burdwan"},
)
check("4. Transfer to pharmacy", r.json().get("ok") is True, r.text)

v = get("%s/verify/%s" % (a.api, batch)).json()
check("5. Verify shows GENUINE", v.get("verdict") == "GENUINE", str(v.get("verdict")))
check(
    "6. Custody trail has 3 entries", len(v.get("history", [])) == 3, str(len(v.get("history", [])))
)

r = post("/anchor-temp", json={"batch_id": batch, "readings": [{"temp": 4.2}, {"temp": 4.4}]})
check("7. Anchor a sensor hash", r.json().get("ok") is True, r.text)

q = get("%s/qr/%s.png" % (a.portal, batch))
check(
    "8. Portal serves a QR code image",
    q.status_code == 200 and q.content[:4] == b"\x89PNG",
    "status %s" % q.status_code,
)

page = get(a.portal + "/")
check("9. Portal page loads", page.status_code == 200 and "PharmaChain" in page.text)

cfg = get(a.portal + "/config.js")
check("10. Portal config points at the API", "PHARMA_API" in cfg.text, cfg.text)

r = post(
    "/report-anomaly",
    json={"batch_id": batch, "reason": "Integration test breach", "readings": [{"temp": 11.0}]},
)
check("11. Report a cold-chain breach", r.json().get("flagged") is True, r.text)

r = post("/report-anomaly", json={"batch_id": batch})
check("12. Repeat report is harmless", r.json().get("already_compromised") is True, r.text)

v = get("%s/verify/%s" % (a.api, batch)).json()
check("13. Verify now shows COMPROMISED", v.get("verdict") == "COMPROMISED", str(v.get("verdict")))

r = post(
    "/transfer-custody", json={"batch_id": batch, "new_holder": "distributor", "location": "X"}
)
check("14. Compromised batch cannot be transferred", r.status_code == 400, r.text)

u = get(a.api + "/verify/DOES-NOT-EXIST")
check(
    "15. Unknown batch returns NOT_FOUND (404)",
    u.status_code == 404 and u.json().get("verdict") == "NOT_FOUND",
    u.text,
)

if a.genuine and a.fake:
    try:
        for label, path in (("genuine", a.genuine), ("fake", a.fake)):
            b = "%s-%s" % (batch, label[0])
            post(
                "/register-batch",
                json={"batch_id": b, "drug_name": "Vaccine X", "location": "Factory"},
            )
            with open(path, "rb") as f:
                res = post("/verify-image", data={"batch_id": b}, files={"image": f}).json()
            verdict = get("%s/verify/%s" % (a.api, b)).json().get("verdict")
            want = "GENUINE" if label == "genuine" else "COMPROMISED"
            check(
                "16. Photo check (%s) leaves batch %s" % (label, want),
                res.get("ok") and verdict == want,
                str(res),
            )
    except Exception as e:
        check("16. Photo check", False, str(e))
else:
    print(
        "%-52s SKIP (pass --genuine and --fake photo paths to include it)"
        % "16. Photo check via Member 4's model"
    )

passed = sum(results)
print("\n%d of %d checks passed" % (passed, len(results)))
sys.exit(0 if passed == len(results) else 1)