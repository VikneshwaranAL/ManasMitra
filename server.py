#!/usr/bin/env python3
"""
ManasMitra Lightweight REST API Server
Built with Python 3 Standard Library (http.server + sqlite3).
Zero external dependencies required.
"""

import http.server
import json
import os
import re
import socketserver
import sqlite3
import sys
import urllib.parse
from datetime import datetime, date

# Ensure UTF-8 console output
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'manasmitra.db')
PORT = 8000

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def ensure_db_schema():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(game_scores);")
        columns = [row[1] for row in cursor.fetchall()]
        if 'level' not in columns:
            cursor.execute("ALTER TABLE game_scores ADD COLUMN level INTEGER DEFAULT 1;")
            conn.commit()
        conn.close()
    except Exception as e:
        print("[DB Schema Check]:", e)

ensure_db_schema()

class ManasMitraRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def _set_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    def _send_json(self, data, status=200):
        body = json.dumps(data, default=str).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self._set_cors_headers()
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            return {}
        raw_body = self.rfile.read(content_length).decode('utf-8')
        try:
            return json.loads(raw_body)
        except json.JSONDecodeError:
            return {}

    # =========================================================================
    # GET ROUTING
    # =========================================================================
    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if not path.startswith('/api/'):
            # Serve static files (index.html, style.css, script.js)
            return super().do_GET()

        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            # 1. Health & Status
            if path == '/api/status':
                cursor.execute("SELECT COUNT(*) FROM patients")
                patient_count = cursor.fetchone()[0]
                cursor.execute("SELECT name FROM patients LIMIT 1")
                first_patient = cursor.fetchone()
                patient_name = first_patient['name'] if first_patient else None

                self._send_json({
                    'status': 'online',
                    'service': 'ManasMitra REST API',
                    'database': 'SQLite 3 (manasmitra.db)',
                    'patient_count': patient_count,
                    'active_patient': patient_name,
                    'timestamp': datetime.now().isoformat()
                })

            # 2. Patient Profile
            elif path == '/api/patient':
                cursor.execute("SELECT * FROM patients ORDER BY id DESC LIMIT 1")
                row = cursor.fetchone()
                if row:
                    self._send_json(dict(row))
                else:
                    self._send_json({'error': 'No registered patient found'}, 404)

            # 3. Weekly Assessments
            elif path == '/api/assessments':
                cursor.execute("SELECT * FROM assessments ORDER BY assessment_date DESC, id DESC")
                rows = [dict(r) for r in cursor.fetchall()]
                self._send_json(rows)

            # 4. Cognitive Games Catalog
            elif path == '/api/games':
                cursor.execute("SELECT * FROM cognitive_games ORDER BY stage, title")
                rows = [dict(r) for r in cursor.fetchall()]
                self._send_json(rows)

            # 5. Game Scores
            elif path == '/api/scores':
                cursor.execute("SELECT * FROM game_scores ORDER BY played_at ASC, id ASC")
                rows = [dict(r) for r in cursor.fetchall()]
                self._send_json(rows)

            # 6. Reminders with Today's Status
            elif path == '/api/reminders':
                today_str = date.today().isoformat()
                query = """
                SELECT r.*, 
                       COALESCE(l.status, 'pending') as today_status,
                       l.snooze_until,
                       l.snooze_count,
                       l.completed_at
                FROM reminders r
                LEFT JOIN reminder_logs l ON r.id = l.reminder_id AND l.log_date = ?
                WHERE r.is_active = 1
                ORDER BY r.scheduled_time ASC
                """
                cursor.execute(query, (today_str,))
                rows = [dict(r) for r in cursor.fetchall()]
                self._send_json(rows)

            # 7. Memory Book
            elif path == '/api/memories':
                cursor.execute("SELECT * FROM memory_book ORDER BY id DESC")
                rows = [dict(r) for r in cursor.fetchall()]
                self._send_json(rows)

            # 8. Family Directory
            elif path == '/api/family':
                cursor.execute("SELECT * FROM family_members ORDER BY is_primary DESC, id ASC")
                rows = [dict(r) for r in cursor.fetchall()]
                self._send_json(rows)

            # 9. AI Insights
            elif path == '/api/ai-insights':
                # Compute live stats
                cursor.execute("SELECT COUNT(*), AVG(score) FROM game_scores")
                scores_stats = cursor.fetchone()
                games_count = scores_stats[0] or 0
                avg_score = round(scores_stats[1] or 0, 1)

                today_str = date.today().isoformat()
                cursor.execute("SELECT COUNT(*) FROM reminders WHERE is_active = 1")
                total_reminders = cursor.fetchone()[0] or 0
                
                cursor.execute("""
                SELECT COUNT(*) FROM reminder_logs 
                WHERE log_date = ? AND status = 'completed'
                """, (today_str,))
                completed_today = cursor.fetchone()[0] or 0

                task_pct = round((completed_today / total_reminders * 100), 1) if total_reminders > 0 else 0.0

                cursor.execute("SELECT current_stage FROM patients LIMIT 1")
                stage_row = cursor.fetchone()
                current_stage = stage_row[0] if stage_row else 'Stage I'

                # Adaptive recommendations
                recs = []
                if games_count >= 3 and avg_score >= 80:
                  recs.append("Cognitive agility is high. Continue routine daily games.")
                else:
                  recs.append("Gentle daily activities help strengthen working memory.")

                if task_pct >= 66:
                  recs.append(f"Routine adherence is strong ({completed_today}/{total_reminders} completed today).")
                else:
                  recs.append("Remember to maintain routine hydration and morning medication.")

                recs.append("Revisit the weekly cognitive screening on Sunday to track stage alignment.")
                recs.append("Regular conversations with family members stimulate active language centers.")

                self._send_json({
                    'games_count': games_count,
                    'avg_accuracy': avg_score,
                    'task_completion_pct': task_pct,
                    'recommended_stage': current_stage,
                    'recommendations': recs,
                    'generated_at': datetime.now().isoformat()
                })

            else:
                self._send_json({'error': f'Route {path} not found'}, 404)

            conn.close()

        except Exception as err:
            self._send_json({'error': str(err)}, 500)

    # =========================================================================
    # POST ROUTING
    # =========================================================================
    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        body = self._read_json_body()

        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            # 1. Register Patient
            if path == '/api/patient/register':
                name = body.get('name', '').strip()
                age = int(body.get('age', 0))
                caregiver = body.get('caregiver_name', '').strip()
                phone = body.get('phone_number', '').strip()
                lang = body.get('preferred_language', 'English')
                pin = str(body.get('pin', '')).strip()
                avatar = body.get('avatar', '👵')

                if not name or age < 5 or age > 89 or len(pin) != 4:
                    conn.close()
                    return self._send_json({'error': 'Invalid registration data.'}, 400)

                cursor.execute("""
                INSERT INTO patients (name, age, caregiver_name, phone_number, preferred_language, pin, avatar)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (name, age, caregiver, phone, lang, pin, avatar))
                patient_id = cursor.lastrowid
                conn.commit()
                conn.close()
                self._send_json({'success': True, 'patient_id': patient_id, 'message': 'Registered successfully.'}, 201)

            # 2. Login Patient
            elif path == '/api/patient/login':
                name = body.get('name', '').strip()
                pin = str(body.get('pin', '')).strip()

                cursor.execute("SELECT * FROM patients WHERE LOWER(name) = LOWER(?) AND pin = ? LIMIT 1", (name, pin))
                row = cursor.fetchone()
                conn.close()

                if row:
                    self._send_json({'success': True, 'patient': dict(row)})
                else:
                    self._send_json({'success': False, 'error': 'Incorrect Name or PIN.'}, 401)

            # 3. Record Assessment
            elif path == '/api/assessments':
                patient_id = body.get('patient_id', 1)
                score = int(body.get('score', 0))
                stage = body.get('stage', 'Stage I')
                details = json.dumps(body.get('details', {}))
                today_str = date.today().isoformat()

                cursor.execute("""
                INSERT INTO assessments (patient_id, assessment_date, score, stage, details_json)
                VALUES (?, ?, ?, ?, ?)
                """, (patient_id, today_str, score, stage, details))
                assessment_id = cursor.lastrowid

                # Update patient's current_stage
                cursor.execute("UPDATE patients SET current_stage = ? WHERE id = ?", (stage, patient_id))
                conn.commit()
                conn.close()
                self._send_json({'success': True, 'assessment_id': assessment_id}, 201)

            # 4. Record Game Score
            elif path == '/api/scores':
                patient_id = body.get('patient_id', 1)
                game_id = body.get('game_id', 'g_s1_memory')
                game_name = body.get('game_name', 'Game')
                stage = body.get('stage', 'Stage I')
                score = int(body.get('score', 100))
                duration = int(body.get('duration_seconds', 0))
                level = int(body.get('level', 1))

                cursor.execute("""
                INSERT INTO game_scores (patient_id, game_id, game_name, stage, score, duration_seconds, level)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (patient_id, game_id, game_name, stage, score, duration, level))
                score_id = cursor.lastrowid
                conn.commit()
                conn.close()
                self._send_json({'success': True, 'score_id': score_id, 'level': level}, 201)

            # 5. Add Reminder
            elif path == '/api/reminders':
                patient_id = body.get('patient_id', 1)
                task_name = body.get('task_name', '').strip()
                scheduled_time = body.get('scheduled_time', '12:00').strip()
                repeat_type = body.get('repeat_type', 'daily')

                if not task_name:
                    conn.close()
                    return self._send_json({'error': 'Task name is required'}, 400)

                cursor.execute("""
                INSERT INTO reminders (patient_id, task_name, scheduled_time, repeat_type)
                VALUES (?, ?, ?, ?)
                """, (patient_id, task_name, scheduled_time, repeat_type))
                reminder_id = cursor.lastrowid
                conn.commit()
                conn.close()
                self._send_json({'success': True, 'reminder_id': reminder_id}, 201)

            # 6. Add Memory
            elif path == '/api/memories':
                patient_id = body.get('patient_id', 1)
                title = body.get('title', '').strip()
                desc = body.get('description', '').strip()
                mem_date = body.get('memory_date', 'Recent').strip()
                preset_icon = body.get('preset_icon', 'family')
                image_data = body.get('image_data', None)

                if not title:
                    conn.close()
                    return self._send_json({'error': 'Title is required'}, 400)

                cursor.execute("""
                INSERT INTO memory_book (patient_id, title, description, memory_date, preset_icon, image_data)
                VALUES (?, ?, ?, ?, ?, ?)
                """, (patient_id, title, desc, mem_date, preset_icon, image_data))
                memory_id = cursor.lastrowid
                conn.commit()
                conn.close()
                self._send_json({'success': True, 'memory_id': memory_id}, 201)

            # 7. Add Family Member
            elif path == '/api/family':
                patient_id = body.get('patient_id', 1)
                name = body.get('name', '').strip()
                relation = body.get('relationship', '').strip()
                phone = body.get('phone', '').strip()
                email = body.get('email', '').strip()
                city = body.get('city', '').strip()
                role = body.get('support_role', 'Family')
                notes = body.get('notes', '').strip()
                is_primary = 1 if body.get('is_primary') else 0

                if not name or not phone:
                    conn.close()
                    return self._send_json({'error': 'Name and phone required'}, 400)

                # Validate phone (7 to 15 digits)
                digits = re.sub(r'\D', '', phone)
                if len(digits) < 7 or len(digits) > 15:
                    conn.close()
                    return self._send_json({'error': 'Valid phone number required (7 to 15 digits)'}, 400)

                # If designated as primary, clear any previous primary for this patient
                if is_primary:
                    cursor.execute("UPDATE family_members SET is_primary = 0 WHERE patient_id = ?", (patient_id,))

                cursor.execute("""
                INSERT INTO family_members (patient_id, name, relationship, phone, email, city, support_role, notes, is_primary)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (patient_id, name, relation, phone, email, city, role, notes, is_primary))
                fam_id = cursor.lastrowid
                conn.commit()
                conn.close()
                self._send_json({'success': True, 'family_id': fam_id, 'is_primary': is_primary}, 201)

            else:
                conn.close()
                self._send_json({'error': f'Route {path} not found'}, 404)

        except Exception as err:
            self._send_json({'error': str(err)}, 500)

    # =========================================================================
    # PUT ROUTING
    # =========================================================================
    def do_PUT(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        body = self._read_json_body()

        def parse_id(val):
            digits = re.findall(r'\d+', str(val))
            return int(digits[-1]) if digits else None

        # Route: /api/reminders/<id>/status
        match = re.match(r'^/api/reminders/([\w\-]+)/status$', path)
        if match:
            reminder_id = parse_id(match.group(1))
            if reminder_id is None:
                return self._send_json({'error': 'Invalid reminder ID'}, 400)

            status = body.get('status', 'completed') # completed, snoozed_once, skipped_today
            snooze_until = body.get('snooze_until', None)
            today_str = date.today().isoformat()

            try:
                conn = get_db_connection()
                cursor = conn.cursor()

                snooze_increment = 1 if status == 'snoozed_once' else 0
                completed_at_val = datetime.now().isoformat() if status == 'completed' else None

                cursor.execute("""
                INSERT INTO reminder_logs (reminder_id, log_date, status, snooze_count, snooze_until, completed_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(reminder_id, log_date) DO UPDATE SET
                    status = excluded.status,
                    snooze_count = reminder_logs.snooze_count + excluded.snooze_count,
                    snooze_until = excluded.snooze_until,
                    completed_at = excluded.completed_at
                """, (reminder_id, today_str, status, snooze_increment, snooze_until, completed_at_val))

                conn.commit()
                conn.close()
                return self._send_json({'success': True, 'reminder_id': reminder_id, 'status': status})
            except Exception as err:
                return self._send_json({'error': str(err)}, 500)

        self._send_json({'error': f'Route {path} not found'}, 404)

    # =========================================================================
    # DELETE ROUTING
    # =========================================================================
    def do_DELETE(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        def parse_id(val):
            digits = re.findall(r'\d+', str(val))
            return int(digits[-1]) if digits else None

        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            # DELETE /api/reminders/<id>
            match_rem = re.match(r'^/api/reminders/([\w\-]+)$', path)
            if match_rem:
                rem_id = parse_id(match_rem.group(1))
                if rem_id:
                    cursor.execute("DELETE FROM reminders WHERE id = ?", (rem_id,))
                    conn.commit()
                conn.close()
                return self._send_json({'success': True, 'deleted_id': match_rem.group(1)})

            # DELETE /api/memories/<id>
            match_mem = re.match(r'^/api/memories/([\w\-]+)$', path)
            if match_mem:
                mem_id = parse_id(match_mem.group(1))
                if mem_id:
                    cursor.execute("DELETE FROM memory_book WHERE id = ?", (mem_id,))
                    conn.commit()
                conn.close()
                return self._send_json({'success': True, 'deleted_id': match_mem.group(1)})

            # DELETE /api/family/<id>
            match_fam = re.match(r'^/api/family/([\w\-]+)$', path)
            if match_fam:
                fam_id = parse_id(match_fam.group(1))
                if fam_id:
                    cursor.execute("DELETE FROM family_members WHERE id = ?", (fam_id,))
                    conn.commit()
                conn.close()
                return self._send_json({'success': True, 'deleted_id': match_fam.group(1)})

            conn.close()
            self._send_json({'error': f'Route {path} not found'}, 404)

        except Exception as err:
            self._send_json({'error': str(err)}, 500)

def run_server(port=PORT):
    # If database not initialized, auto-initialize
    if not os.path.exists(DB_PATH):
        import db_setup
        db_setup.init_database()
    else:
        # Ensure backward-compatible is_primary column exists in family_members
        try:
            mig_conn = sqlite3.connect(DB_PATH)
            mig_cursor = mig_conn.cursor()
            try:
                mig_cursor.execute("ALTER TABLE family_members ADD COLUMN is_primary INTEGER DEFAULT 0")
                mig_conn.commit()
            except sqlite3.OperationalError:
                pass
            mig_cursor.execute("UPDATE family_members SET is_primary = 1 WHERE id = 1 AND is_primary = 0")
            mig_conn.commit()
            mig_conn.close()
        except Exception as e:
            print(f"[!] Migration check note: {e}")

    handler = ManasMitraRequestHandler
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), handler) as httpd:
        print("=" * 60)
        print(f"[ManasMitra Backend] Server active at: http://localhost:{port}")
        print(f"[ManasMitra Backend] Serving API + Web App directly from {BASE_DIR}")
        print(f"[ManasMitra Backend] SQLite Database: {DB_PATH}")
        print("=" * 60)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[ManasMitra Backend] Server stopped cleanly.")

if __name__ == '__main__':
    port = PORT
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    run_server(port)
