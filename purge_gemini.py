import sqlite3
import os

db_path = os.path.expanduser("~/.cletus/state.db")
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM model_registry WHERE model_id LIKE '%gemini%' OR model_id LIKE '%gemma%'")
    conn.commit()
    conn.close()
    print("Purged gemini/gemma from model_registry table in state.db")
