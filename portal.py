import io
import json
import os
from urllib.parse import quote

import qrcode
from flask import Flask, Response, request, send_from_directory

app = Flask(__name__, static_folder="static")


@app.get("/")
def index():
    return send_from_directory("static", "index.html")


@app.get("/config.js")
def config_js():
    """Tells the page where Member 2's API lives."""
    host = request.host.split(":")[0]
    api = os.environ.get("API_BASE") or "http://%s:5000" % host
    return Response("window.PHARMA_API = %s;" % json.dumps(api), mimetype="application/javascript")


@app.get("/qr/<batch_id>.png")
def qr(batch_id):
    """QR code that opens this portal on the batch's page."""
    url = request.host_url + "?batch=" + quote(batch_id, safe="")
    img = qrcode.make(url, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(buf.getvalue(), mimetype="image/png")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)