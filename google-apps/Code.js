//This is a cloud Run phishing check using ML module, trained on CEAR_08 dataset from kaggle.

// ---- CONFIG ----
var PREDICT_BASE = 'https://get-your-own-cloud-service/predict'; //GET endpoint
var MAX_BODY_CHARS = 500; 
// ----------------


function onGmailMessage(e) {
  var messageId = (e && e.gmail && e.gmail.messageId) ? e.gmail.messageId : (e && e.messageId) ? e.messageId : '';

  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Phishing Scanner')
      .setSubtitle('Email Security Check'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText('Analyze this email for potential phishing threats.'))
      .addWidget(CardService.newButtonSet()
        .addButton(CardService.newTextButton()
          .setText('Scan for Phishing')
          .setOnClickAction(CardService.newAction()
            .setFunctionName('scanForPhishing')
            .setParameters({ messageId: messageId })))))
    .build();

  return [card];
}

/** Button handler */
function scanForPhishing(e) {
  try {
    var messageId = e && e.parameters && e.parameters.messageId;
    if (!messageId) return createErrorResponse('Missing message ID.');

    //get email fields
    var msg = GmailApp.getMessageById(messageId);
    var from = msg.getFrom() || '';
    var to = msg.getTo() || (msg.getReplyTo() || '');
    var subject = msg.getSubject() || '';
    var body = (msg.getPlainBody && msg.getPlainBody()) || msg.getBody() || '';

    //Trim body to avoid UrlFetch URL length errors, can be changed above if neccasery
    if (body.length > MAX_BODY_CHARS) {
      body = body.slice(0, MAX_BODY_CHARS) + '...[truncated]';
    }

    //Rough URL count
    var urlsCount = (body.match(/\bhttps?:\/\/[^\s<>"'()]+/gi) || []).length;

    //Build query for backend
    var url = buildUrl_(PREDICT_BASE, {
      sender: from,
      receiver: to,
      subject: subject,
      body: body,
      urls: String(urlsCount)
    });

    //Call backend
    var res = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true
    });

    var code = res.getResponseCode();
    var text = res.getContentText();

    if (code < 200 || code >= 300) {
      return createErrorResponse('Backend ' + code + ': ' + text);
    }

    //parsing server res
    var riskLevel = 'UNKNOWN';
    var line = 'No prediction';

    try {
      var data = JSON.parse(text);
      var pred = (data && data.prediction) ? data.prediction : {};
      var label = (pred.label != null ? String(pred.label) : '');
      var confidence = (typeof pred.confidence_pct === 'number') ? pred.confidence_pct : null;

      riskLevel = mapLabelToRisk_(label);
      line = label ? label : 'Prediction';
      if (confidence != null) line += ' (' + confidence.toFixed(2) + '%)';
    } catch (ignore) {
      //generic error if not json res from server
      riskLevel = 'UNKNOWN';
      line = 'Backend returned non-JSON response';
    }

    var card = buildResultCard_(riskLevel, line);
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().updateCard(card))
      .build();

  } catch (err) {
    return createErrorResponse('Scan failed: ' + (err && err.message ? err.message : err));
  }
}

//mapping backend labels to user friendly risk levels
function mapLabelToRisk_(label) {
  var l = (label || '').toLowerCase();
  if (l === 'phishing' || l === 'malicious') return 'HIGH RISK';
  if (l === 'legitimate' || l === 'benign')  return 'SAFE';
  if (l === 'suspicious') return 'MEDIUM RISK';
  return 'UNKNOWN';
}

//Build URL with encoded query params 
function buildUrl_(base, params) {
  var pairs = [];
  for (var k in params) {
    if (!params.hasOwnProperty(k)) continue;
    var v = params[k];
    if (v == null) continue;
    pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
  }
  return base + (pairs.length ? ('?' + pairs.join('&')) : '');
}

//resulting phishing score widget window build
function buildResultCard_(riskLevel, line) {
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Phishing Scanner')
      .setSubtitle('Analysis'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText('<b>Risk Level:</b> ' + esc_(riskLevel)))
      .addWidget(CardService.newTextParagraph()
        .setText(esc_(line))))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newButtonSet()
        .addButton(CardService.newTextButton()
          .setText('Scan Again')
          .setOnClickAction(CardService.newAction()
            .setFunctionName('onGmailMessage')))))
    .build();
  return card;
}

//helper func to replace HTML-like chars, avoiding bugs in google ResultCard engine
function esc_(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// in case of error...
function createErrorResponse(msg) {
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Error'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText(esc_(msg))))
    .build();
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(card))
    .build();
}
