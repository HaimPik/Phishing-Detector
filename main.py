import os
import traceback
from flask import Flask, request, jsonify


import module as m  

app = Flask(__name__)

def prediction_payload(sender: str, receiver: str, subject: str, body: str, urls: str):
    """
    Build the same input text your module uses, run through the already trained
    vectorizer+model that live in your imported module, and return a JSON-able dict.
    """
    input_text = f"{sender} {receiver} {subject} {body} {urls}"
    input_vector = m.vectorizer.transform([input_text])

    pred = m.model.predict(input_vector)[0]
    proba = m.model.predict_proba(input_vector)[0]
    confidence = float(max(proba) * 100.0)

    label_str = "Phishing"
    try:
        # label numeric 0/1
        label_str = "Phishing" if int(pred) == 1 else "Legitimate"
    except Exception:
        # string label
        label_lower = str(pred).lower()
        label_str = "Phishing" if "phish" in label_lower or "spam" in label_lower else "Legitimate"

    
    try:
        value = int(pred)
    except Exception:
        value = pred

    return {
        "label": label_str,
        "value": value,
        "confidence_pct": round(confidence, 2),
    }

@app.route("/predict", methods=["GET"])
def predict():
    try:
        sender = request.args.get("sender", "", type=str)
        receiver = request.args.get("receiver", "", type=str)
        subject = request.args.get("subject", "", type=str)
        body = request.args.get("body", "", type=str)
        urls = request.args.get("urls", "", type=str)

        try:
            m.predict_custom_email(sender, receiver, subject, body, urls)
        except Exception:
            # If function ever changes, dont fail the API because of a print error.
            pass

        # (B) Return a JSON payload computed from the same model/vectorizer
        result = prediction_payload(sender, receiver, subject, body, urls)

        return jsonify({
            "prediction": result,
            "input_echo": {
                "sender": sender,
                "receiver": receiver,
                "subject": subject,
                "body": body,
                "urls": urls,
            }
        })
    except Exception as e:
        return jsonify({
            "error": str(e),
            "trace": traceback.format_exc()
        }), 500

@app.route("/health", methods=["GET"])
def health():
    #For sanity check against backend deployment and debug purposes.
    try:
        model_name = getattr(m.model, "__class__", type("X",(object,),{})()).__name__
    except Exception:
        model_name = "unknown"
    return jsonify({
        "status": "ok",
        "model": model_name,
        "vectorizer": "TfidfVectorizer (from your module)",
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
