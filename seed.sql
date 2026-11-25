-- ==============================================================================
-- ManasMitra Starter Seed Data
-- ==============================================================================

-- 1. Seed Master Cognitive Games Catalog (14 Activities)
INSERT INTO cognitive_games (id, stage, title, category, icon, instructions) VALUES
('g_s1_memory', 'Stage I', 'Memory Match Cards', 'Memory', '🃏', 'Find matching pairs of symbols by flipping over two cards at a time.'),
('g_s1_remember', 'Stage I', 'Remember Object', 'Attention', '🔍', 'Memorize the item shown on screen, then pick the exact match.'),
('g_s1_number_seq', 'Stage I', 'Number Sequence', 'Logic', '🔢', 'Select the missing number to complete the sequence.'),
('g_s1_pattern', 'Stage I', 'Pattern Completion', 'Patterns', '🔷', 'Look at the sequence of shapes and choose the next pattern.'),
('g_s1_routine', 'Stage I', 'Daily Routine Challenge', 'Routine', '☀️', 'Choose the correct sequence of morning routines.'),

('g_s2_what_object', 'Stage II', 'What Object Is This?', 'Recognition', '🫖', 'Identify the familiar object displayed below.'),
('g_s2_family_pic', 'Stage II', 'Simple Family Picture', 'Recognition', '👨‍👩‍👧', 'Read the warm family clue and identify the loved one.'),
('g_s2_places', 'Stage II', 'Place Recognition', 'Spatial', '🏡', 'Identify which room or place is described in the clue.'),
('g_s2_faces', 'Stage II', 'Face Recognition', 'Emotion', '😊', 'Tap the friendly smiling face among the choices.'),
('g_s2_music', 'Stage II', 'Familiar Music', 'Auditory', '🪕', 'Which musical instrument creates this acoustic melody?'),

('g_s3_popular_faces', 'Stage III', 'Popular & Familiar Faces', 'Familiarity', '👵', 'Touch the friendly grandmother face.'),
('g_s3_used_objects', 'Stage III', 'Frequently Used Objects', 'Tactile', '🪥', 'Touch the item you use every morning to brush teeth.'),
('g_s3_picture_touch', 'Stage III', 'Picture Interaction', 'Interaction', '🌻', 'Touch the bright blooming sunflower.'),
('g_s3_language', 'Stage III', 'Linguistic / Language Activity', 'Language', '🔤', 'Complete the comforting word: M A N _ S');

-- 2. Seed Sample Patient Profile (Shanti Devi)
INSERT INTO patients (id, name, age, caregiver_name, phone_number, preferred_language, pin, avatar, current_stage) VALUES
(1, 'Shanti Devi', 68, 'Rajesh Sharma (Son)', '+91 98765 43210', 'English', '1234', '👵', 'Stage I');

-- 3. Seed Initial Weekly Assessment
INSERT INTO assessments (id, patient_id, assessment_date, score, stage, details_json) VALUES
(1, 1, DATE('now', '-2 days'), 6, 'Stage I', '{"q1_day":1,"q2_object":1,"q3_word":1,"q4_number":1,"q5_odd":1,"q6_routine":1}');

-- 4. Seed Historical Game Scores (Powers Progress Chart)
INSERT INTO game_scores (patient_id, game_id, game_name, stage, score, duration_seconds, played_at) VALUES
(1, 'g_s1_memory', 'Memory Match Cards', 'Stage I', 85, 45, DATETIME('now', '-6 days')),
(1, 'g_s1_number_seq', 'Number Sequence', 'Stage I', 100, 20, DATETIME('now', '-5 days')),
(1, 'g_s1_remember', 'Remember Object', 'Stage I', 80, 30, DATETIME('now', '-4 days')),
(1, 'g_s1_pattern', 'Pattern Completion', 'Stage I', 90, 25, DATETIME('now', '-3 days')),
(1, 'g_s1_routine', 'Daily Routine Challenge', 'Stage I', 95, 35, DATETIME('now', '-2 days')),
(1, 'g_s2_what_object', 'What Object Is This?', 'Stage II', 100, 18, DATETIME('now', '-1 days'));

-- 5. Seed Configured Daily Routine Reminders
INSERT INTO reminders (id, patient_id, task_name, scheduled_time, repeat_type, is_active) VALUES
(1, 1, 'Morning Blood Pressure Medicine', '08:30', 'daily', 1),
(2, 1, 'Drink a Glass of Warm Water', '11:00', 'daily', 1),
(3, 1, 'Afternoon Garden Walk & Fresh Air', '17:00', 'daily', 1),
(4, 1, 'Evening Memory Book Reading', '19:30', 'daily', 1);

-- 6. Seed Reminder Logs for Today
INSERT INTO reminder_logs (reminder_id, log_date, status, snooze_count, completed_at) VALUES
(1, DATE('now'), 'completed', 0, DATETIME('now', '-3 hours')),
(2, DATE('now'), 'pending', 0, NULL),
(3, DATE('now'), 'pending', 0, NULL),
(4, DATE('now'), 'pending', 0, NULL);

-- 7. Seed Memory Book Entries
INSERT INTO memory_book (id, patient_id, title, description, memory_date, preset_icon, image_data) VALUES
(1, 1, 'Family Summer Trip to Shillong Hills', 'A joyful afternoon enjoying cool mountain breeze, pine trees, and fresh roasted corn with children and grandchildren.', 'Summer 2023', 'travel', NULL),
(2, 1, 'Morning Chai in the Jasmine Garden', 'Enjoying fresh morning Assam tea sitting beneath the blooming white jasmine creepers in the courtyard.', 'Routine Tradition', 'garden', NULL),
(3, 1, 'Granddaughter Ananya’s 10th Birthday', 'We made homemade kheer, sang festive songs together, and gifted her a colorful storybook.', 'October 2024', 'family', NULL);

-- 8. Seed Family Directory
INSERT INTO family_members (id, patient_id, name, relationship, phone, email, city, support_role, notes, is_primary) VALUES
(1, 1, 'Rajesh Sharma', 'Son', '+91 98765 43210', 'rajesh.sharma@example.com', 'Guwahati', 'Caregiver', 'Manages morning medication & weekly groceries', 1),
(2, 1, 'Ananya Sharma', 'Granddaughter', '+91 98765 11223', 'ananya@example.com', 'Shillong', 'Family', 'Calls every evening at 7:00 PM for storytime', 0),
(3, 1, 'Dr. A. Sen', 'Family Physician', '+91 98765 88990', 'dr.sen@wellnessclinic.org', 'Guwahati', 'Doctor', 'Available for routine monthly cognitive checkups', 0);

-- 9. Seed AI Insights
INSERT INTO ai_insights (patient_id, games_count, avg_accuracy, task_completion_pct, recommended_stage, recommendations_json) VALUES
(1, 6, 91.67, 75.00, 'Stage I', '[
  "Cognitive accuracy is high. Continue memory and pattern activities daily to maintain mental agility.",
  "Routine adherence is strong. Morning medication consistently completed.",
  "Schedule your next weekly cognitive checkup on Sunday to keep activities closely matched to your stage.",
  "Family connection stimulates language centers. Keep calling Ananya in the evening."
]');
