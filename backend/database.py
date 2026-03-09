import psycopg2
import os
from dotenv import load_dotenv
load_dotenv()


def get_db_connection():
    db_uri = os.getenv("DB_URI")

    if not db_uri:
        raise ValueError("DB_URI environment variable not set")

    try:
        conn = psycopg2.connect(db_uri)
        return conn

    except Exception as e:
        print("Database connection error:", e)
        raise