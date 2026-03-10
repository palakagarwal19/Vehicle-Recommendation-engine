# Add these two blocks to app.py, right after:
#   app = Flask(__name__)
#   CORS(app)

# ── Always return JSON on 500s so CORS headers are included ──────────────────
import traceback

@app.errorhandler(500)
def internal_error(e):
    # flask-cors only adds headers to successful responses;
    # this handler ensures 500s also get Access-Control-Allow-Origin
    tb = traceback.format_exc()
    print(tb)
    response = jsonify({"error": "Internal server error", "detail": str(e)})
    response.status_code = 500
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response

@app.errorhandler(Exception)
def unhandled_exception(e):
    tb = traceback.format_exc()
    print(tb)
    response = jsonify({"error": type(e).__name__, "detail": str(e)})
    response.status_code = 500
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response