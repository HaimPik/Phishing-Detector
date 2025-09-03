import pandas as pd
import numpy as np
import nltk
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix



nltk.download('stopwords')
stop_words = list(nltk.corpus.stopwords.words("english")) 



df = pd.read_csv("./archive/CEAS_08.csv")
df.columns = df.columns.str.strip().str.lower()
print("Columns found:", df.columns.tolist())

expected_columns = ['sender', 'receiver', 'date', 'subject', 'body', 'urls', 'label']
missing = set(expected_columns) - set(df.columns)
if missing:
    print("Missing columns:", missing)

#Fill missing data in dataset
for col in expected_columns:
    if col not in df.columns:
        df[col] = ""

df.fillna("", inplace=True)


df['text'] = df[['sender', 'receiver', 'subject', 'body', 'urls']].astype(str).agg(' '.join, axis=1)


vectorizer = TfidfVectorizer(stop_words=stop_words, lowercase=True)
X = vectorizer.fit_transform(df['text'])
y = df['label']


X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

#Training model
model = LogisticRegression(max_iter=1000)
model.fit(X_train, y_train)

def predict_custom_email(sender, receiver, subject, body, urls):

    input_text = f"{sender} {receiver} {subject} {body} {urls}"
    input_vector = vectorizer.transform([input_text])
    prediction = model.predict(input_vector)[0]
    prob = model.predict_proba(input_vector)[0]

    label_str = "Phishing" if prediction == 1 else "Legitimate"
    confidence = round(max(prob) * 100, 2)

    print(f"\n Prediction: {label_str} ({confidence}% confidence)")
    