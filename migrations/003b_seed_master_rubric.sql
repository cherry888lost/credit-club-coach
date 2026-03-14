-- Seed: Credit Club Master Rubric v1
-- Run after 003_controlled_learning_system.sql

INSERT INTO master_rubric (
  org_id, version, is_active, categories, disqualification_rules, low_signal_criteria, notes, created_by
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  1,
  true,
  '{
    "discovery": {
      "name": "Discovery Quality",
      "weight": 1.0,
      "description": "Did the rep uncover the prospect''s real situation, goals, timeline, and buying motivation before pitching?",
      "score_anchors": {
        "0_2": "No questions asked. Jumped straight to pitch. Zero understanding of prospect.",
        "3_4": "Surface questions only (''what do you do?''). No follow-up. Missed obvious threads.",
        "5_6": "Asked about credit situation and goals but didn''t dig deeper. Missed emotional drivers.",
        "7_8": "Strong discovery — uncovered situation, goals, timeline, and some emotional motivation. Asked ''why now?''",
        "9_10": "Elite discovery — understood financial picture, emotional pain, urgency driver, decision-making process, and budget reality before any pitch."
      },
      "credit_club_specific": "For Credit Club: Must uncover current credit score range, specific credit goals (mortgage, car, business funding), timeline pressure, past attempts to fix credit, and what''s at stake if nothing changes.",
      "red_flags": ["Pitching before asking any questions", "Not asking about credit score", "Ignoring timeline cues", "Not exploring ''why now?''"],
      "green_flags": ["''Tell me about your credit situation right now''", "''What made you book this call today?''", "''What happens if nothing changes in 6 months?''", "Asking about specific debts/accounts"]
    },

    "pain_amplification": {
      "name": "Pain Amplification",
      "weight": 1.0,
      "description": "Did the rep deepen the emotional impact of the prospect''s credit problems and connect poor credit to real-life consequences?",
      "score_anchors": {
        "0_2": "No pain discussed. Features-only pitch.",
        "3_4": "Acknowledged pain but moved on quickly. ''Yeah that sucks, so here''s what we offer...''",
        "5_6": "Explored pain somewhat but didn''t connect it to real consequences or future impact.",
        "7_8": "Good pain amplification — connected current credit issues to tangible life impact (denied mortgage, high interest, stress).",
        "9_10": "Masterful — prospect felt the full weight of inaction. Connected to family, lifestyle, financial future. Prospect articulated their own urgency."
      },
      "credit_club_specific": "For Credit Club: Connect bad credit to denied mortgage applications, high car finance rates, rejected business loans, stress of financial uncertainty. Make them feel what another 6-12 months of bad credit costs them.",
      "red_flags": ["Skipping pain entirely", "Minimizing the prospect''s problems", "Moving to pitch before pain is felt"],
      "green_flags": ["''What does that mean for your mortgage plans?''", "''How does that make you feel?''", "''What''s the cost of doing nothing for another year?''", "Prospect says ''I need to fix this''"]
    },

    "rapport_tone": {
      "name": "Rapport & Tone",
      "weight": 1.0,
      "description": "Did the rep build genuine connection? Was the tone warm, conversational, and empathetic — not robotic or scripted?",
      "score_anchors": {
        "0_2": "Cold, robotic, reading a script. Prospect felt like a number.",
        "3_4": "Polite but mechanical. No personal connection. Generic small talk.",
        "5_6": "Decent rapport but formulaic. Some warmth but felt rehearsed.",
        "7_8": "Natural conversation. Genuine interest in the person. Prospect opened up willingly.",
        "9_10": "Instant connection. Prospect felt understood and comfortable. Laughing, sharing, trusting. Felt like talking to a friend who happens to be an expert."
      },
      "credit_club_specific": "Credit is deeply personal. Prospects feel shame about bad credit. Rep must create a judgment-free zone quickly. Show they''ve helped people in similar situations.",
      "red_flags": ["Reading from a script", "Interrupting constantly", "No empathy for credit shame", "Talking AT the prospect"],
      "green_flags": ["Using prospect''s name naturally", "Sharing relevant personal/client stories", "Active listening signals", "''You''re not alone in this''"]
    },

    "authority_confidence": {
      "name": "Authority & Confidence",
      "weight": 1.0,
      "description": "Did the rep position themselves as a knowledgeable expert? Did they speak with certainty and conviction?",
      "score_anchors": {
        "0_2": "Sounded unsure, apologetic, seeking validation. ''I think maybe we could help...''",
        "3_4": "Some knowledge shown but hedging. Uncertain language. Deferred to ''the team'' too much.",
        "5_6": "Generally confident but wobbled under pressure or tough questions.",
        "7_8": "Spoke with conviction. Demonstrated expertise. Prospect trusted their guidance.",
        "9_10": "Total authority. Expert positioning. Used specific numbers, case studies, process details. Prospect felt ''this person knows exactly how to fix my problem.''"
      },
      "credit_club_specific": "Must demonstrate knowledge of credit bureaus, dispute processes, score factors, and specific Credit Club success stories. Reference specific numbers (''we''ve helped 200+ clients add 100+ points'').",
      "red_flags": ["''I''m not sure but...''", "Can''t answer basic credit questions", "Deferring everything to later", "Sounding nervous when price comes up"],
      "green_flags": ["Citing specific results", "Explaining processes confidently", "Handling curveball questions smoothly", "''Here''s exactly what happens when you join...''"]
    },

    "offer_explanation": {
      "name": "Offer Explanation",
      "weight": 1.0,
      "description": "Was the Credit Club offer clearly explained with benefits tied to the prospect''s specific pain points?",
      "score_anchors": {
        "0_2": "Dumped features with no connection to prospect. Or barely explained the offer.",
        "3_4": "Listed features but didn''t tie to pain. Generic pitch.",
        "5_6": "Explained offer adequately but missed opportunities to personalize.",
        "7_8": "Tailored explanation — connected specific Credit Club features to the prospect''s stated problems and goals.",
        "9_10": "Prospect could see exactly how Credit Club solves THEIR specific problem. Each feature was a direct answer to a pain point they''d articulated."
      },
      "credit_club_specific": "Must explain: Skool community access, training modules, 1-1 Telegram specialist support, dispute letter templates, credit monitoring guidance, business credit building. Tie each to what the prospect actually needs.",
      "red_flags": ["Feature dumping", "Not connecting to discovery", "Vague about what''s included", "Can''t explain the process"],
      "green_flags": ["''Based on what you told me about X, here''s how we''d tackle that...''", "Specific timeline promises", "Social proof tied to similar situations"]
    },

    "objection_handling": {
      "name": "Objection Handling",
      "weight": 1.0,
      "description": "How well did the rep address concerns about price, timing, trust, spouse, competition, etc.?",
      "score_anchors": {
        "0_2": "Ignored objections or argued. Got defensive or flustered.",
        "3_4": "Acknowledged but gave weak responses. Dropped objections without resolution.",
        "5_6": "Handled some objections adequately but missed others or gave generic answers.",
        "7_8": "Solid handling — isolated, empathized, reframed most objections. Prospect felt heard.",
        "9_10": "Turned objections into selling points. Anticipated concerns. Made the prospect feel their objection actually proved why they need Credit Club."
      },
      "credit_club_specific": "Common Credit Club objections: ''£3k is too expensive'' (reframe: cost of bad credit is higher), ''I can do this myself'' (reframe: time + expertise), ''I need to think about it'' (reframe: what changes in a week?), ''Let me talk to my partner'' (reframe: involve them now).",
      "red_flags": ["''Yeah it is expensive...''", "Ignoring the price objection", "Getting defensive", "Agreeing with the objection without reframing"],
      "green_flags": ["''I totally understand, and here''s why...''", "Isolating the real objection", "Using social proof in response", "''If it wasn''t for the price, would you be ready to start?''"]
    },

    "urgency": {
      "name": "Urgency Creation",
      "weight": 1.0,
      "description": "Did the rep create genuine urgency? Was there a reason to act now versus later?",
      "score_anchors": {
        "0_2": "No urgency whatsoever. ''Take your time, no rush.''",
        "3_4": "Mentioned urgency but it felt fake or pushy. Generic scarcity tactics.",
        "5_6": "Some urgency but not compelling. Prospect didn''t feel real pressure.",
        "7_8": "Good urgency — connected to prospect''s own timeline and goals. Made waiting feel costly.",
        "9_10": "Prospect felt that every day of delay was costing them. Urgency came from their own situation, not fake scarcity."
      },
      "credit_club_specific": "Real urgency for credit: Every month of inaction = more negative marks aging in, missed mortgage windows, higher interest accumulating. Credit disputes take 30-45 days per round — starting today vs next month means real timeline difference.",
      "red_flags": ["''No pressure at all''", "Fake countdown timers", "Not connecting urgency to their situation", "Letting prospect comfortably punt to ''next week''"],
      "green_flags": ["''You mentioned wanting the mortgage by September — let me show you the timeline if we start today vs next month''", "''Each month we don''t start is another month of...''"]
    },

    "close_attempt": {
      "name": "Close Attempt Quality",
      "weight": 1.0,
      "description": "Did the rep actually ask for the sale? How many attempts? Was the close natural and assumptive?",
      "score_anchors": {
        "0_2": "Never asked for the sale. Ended with ''let me know what you think.''",
        "3_4": "One weak close attempt. ''So would you like to sign up?'' then gave up.",
        "5_6": "Attempted to close but backed off at first resistance. Didn''t persist.",
        "7_8": "Multiple close attempts, naturally woven in. Handled initial ''no'' and tried again from different angle.",
        "9_10": "Assumptive close throughout. Multiple attempts felt natural, not pushy. Used trial closes to gauge readiness. Final close was confident and direct."
      },
      "credit_club_specific": "Credit Club closes: ''Let''s get you started today so we can file your first disputes this week'', ''I''ll send the payment link now — would you prefer the full programme or the deposit option?'', ''The sooner we start, the sooner those items start dropping off.''",
      "red_flags": ["Never asking for money", "''Just think about it''", "Only one attempt then quitting", "Passive language (''if you decide...'')"],
      "green_flags": ["Assumptive language", "Multiple close attempts", "Offering payment options proactively", "''Let me get you set up right now''"]
    },

    "follow_up_quality": {
      "name": "Follow-Up Quality",
      "weight": 1.0,
      "description": "Were clear, specific next steps established? Does the prospect know exactly what happens next?",
      "score_anchors": {
        "0_2": "No next steps. Call ended in limbo.",
        "3_4": "Vague ''I''ll follow up'' or ''give me a call back when you''re ready.''",
        "5_6": "Some next steps mentioned but not confirmed or time-bound.",
        "7_8": "Clear next steps with specific time/date. Both parties know what''s happening.",
        "9_10": "Locked in specific callback time, sent confirmation, set up next touch. Prospect committed to a concrete action."
      },
      "credit_club_specific": "For Credit Club: Next steps should include specific callback date/time, sending programme details via WhatsApp/email, connecting prospect to their specialist, or (if closed) onboarding timeline.",
      "red_flags": ["''I''ll be in touch''", "No follow-up scheduled", "Prospect left hanging", "No WhatsApp message sent after call"],
      "green_flags": ["''I''ll call you Thursday at 3pm — does that work?''", "Sending payment/info link during the call", "''Check your WhatsApp, I just sent you...''"]
    },

    "disqualification_logic": {
      "name": "Disqualification Logic",
      "weight": 1.0,
      "description": "Did the rep correctly identify non-fits and handle them appropriately? Did they waste time on unqualified prospects?",
      "score_anchors": {
        "0_2": "Spent 30+ minutes on someone clearly unqualified. Or disqualified a viable prospect too quickly.",
        "3_4": "Noticed red flags but didn''t act on them. Continued full pitch despite clear non-fit.",
        "5_6": "Some qualification but missed key disqualifiers or took too long to identify them.",
        "7_8": "Identified non-fit relatively early. Handled exit gracefully. Didn''t burn the bridge.",
        "9_10": "Quick, respectful qualification. Identified non-fit within first 5 minutes. Offered alternative if appropriate. Professional exit that left door open."
      },
      "credit_club_specific": "Credit Club disqualifiers: No actual credit issues to fix, currently in active bankruptcy (can''t dispute), no income to afford programme, under 18, already enrolled in competing programme. Non-UK residents (programme is UK-focused).",
      "red_flags": ["45-min pitch to someone with 800 credit score", "Not asking qualifying questions upfront", "Disqualifying someone who just has price concerns"],
      "green_flags": ["Early qualification questions", "''Based on what you''ve told me, I actually don''t think we''re the right fit because...''", "Referral to alternative if not right fit"]
    }
  }'::jsonb,

  '[
    {"rule": "no_credit_issues", "description": "Prospect has excellent credit (750+) with no negatives to dispute", "auto_disqualify": true},
    {"rule": "active_bankruptcy", "description": "Prospect is in active bankruptcy proceedings", "auto_disqualify": true, "note": "Cannot dispute during active bankruptcy"},
    {"rule": "under_18", "description": "Prospect is under 18", "auto_disqualify": true},
    {"rule": "non_uk_resident", "description": "Prospect is not a UK resident and not planning UK credit", "auto_disqualify": true},
    {"rule": "no_income", "description": "Prospect has zero income and cannot afford any payment option", "auto_disqualify": false, "flag_for_review": true},
    {"rule": "already_enrolled_competitor", "description": "Prospect is already in a competing credit programme", "auto_disqualify": false, "flag_for_review": true}
  ]'::jsonb,

  '{
    "min_transcript_length": 500,
    "min_call_duration_seconds": 120,
    "exclude_outcomes": ["disqualified"],
    "min_discovery_score": 2,
    "max_categories_at_zero": 3,
    "exclude_if_no_prospect_speaking": true,
    "notes": "Low-signal calls are excluded from benchmark learning but still scored for rep tracking"
  }'::jsonb,

  'Initial Credit Club master rubric v1. Covers all 10 categories with CC-specific anchors, red/green flags, and disqualification rules.',
  'system'
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Seed initial objection library entries
-- ============================================

INSERT INTO objection_library (org_id, label, display_name, category, raw_phrasings, current_handling_methods, coaching_notes, created_by)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'price_too_high', 'Price Too High', 'price',
   '["That''s too expensive", "I can''t afford £3,000", "Is there a cheaper option?", "That''s a lot of money", "I wasn''t expecting it to cost that much"]'::jsonb,
   '[{"technique": "Cost of Inaction", "script": "I totally understand £3k feels like a big number. But let me ask you this — what''s bad credit already costing you? Higher interest on your car, denied mortgage, stress... over the next 2-3 years that adds up to way more than £3k.", "effectiveness_rating": "strong"},
     {"technique": "Payment Plan Reframe", "script": "We do have a deposit option — you can start with £500 and spread the rest. That way you''re not waiting another month while your credit stays the same.", "effectiveness_rating": "strong"}]'::jsonb,
   'Most common objection. Never agree it''s expensive — reframe to cost of doing nothing.',
   'system'),

  ('00000000-0000-0000-0000-000000000001', 'need_to_think', 'Need to Think About It', 'timing',
   '["I need to think about it", "Let me sleep on it", "I''ll get back to you", "I need some time to decide", "Can I think it over?"]'::jsonb,
   '[{"technique": "Isolate the Real Objection", "script": "Absolutely, I respect that. Just so I can help you make the best decision — is it specifically the investment you need to think about, or is there something else I haven''t addressed?", "effectiveness_rating": "strong"},
     {"technique": "Future Pacing", "script": "Of course. But let me ask — what''s going to be different next week that isn''t true today? Your credit situation will be exactly the same, maybe a little worse.", "effectiveness_rating": "strong"}]'::jsonb,
   '''Need to think'' almost always masks a deeper objection (usually price or trust). Always isolate.',
   'system'),

  ('00000000-0000-0000-0000-000000000001', 'spouse_approval', 'Need Spouse/Partner Approval', 'spouse_partner',
   '["I need to talk to my wife/husband", "My partner handles the finances", "I can''t make this decision alone", "Let me discuss with my other half"]'::jsonb,
   '[{"technique": "Include Them Now", "script": "That makes total sense — it''s a big decision. Is your partner available now? I''d love to walk them through everything so you can make the decision together.", "effectiveness_rating": "strong"},
     {"technique": "Arm Them With Info", "script": "Absolutely. What if I send you a summary of everything we discussed so you can share it? And let''s book a 15-min call with both of you — would tomorrow evening work?", "effectiveness_rating": "average"}]'::jsonb,
   'Always try to get the partner on the call. If not, lock in a specific callback with both present.',
   'system'),

  ('00000000-0000-0000-0000-000000000001', 'can_do_myself', 'Can Do It Myself', 'skepticism',
   '["I can do this myself", "I''ll just Google it", "Why can''t I just dispute myself?", "There''s free resources online", "I''ve already started doing it myself"]'::jsonb,
   '[{"technique": "Time + Expertise Reframe", "script": "You absolutely can — anyone can file disputes. The question is: do you want to spend 6-12 months figuring out what works, or do you want a proven system with expert support that gets results in 60-90 days?", "effectiveness_rating": "strong"},
     {"technique": "Acknowledge + Differentiate", "script": "Love that energy — DIY is great for some things. The challenge is credit bureaus have specific processes, and one wrong move can actually make things worse. We''ve done this 200+ times and know exactly which disputes stick.", "effectiveness_rating": "strong"}]'::jsonb,
   'Never dismiss the DIY approach — acknowledge it, then position Credit Club as the faster, safer path.',
   'system'),

  ('00000000-0000-0000-0000-000000000001', 'bad_timing', 'Bad Timing', 'timing',
   '["Now isn''t a good time", "Maybe next month", "I''m dealing with other things right now", "After Christmas/holiday", "When I get paid"]'::jsonb,
   '[{"technique": "Cost of Delay", "script": "I hear you. But here''s the thing — every month you wait, those negative marks age another month on your report. If you start today, by next month you could already have your first round of disputes back. If you wait, you''re a month further behind.", "effectiveness_rating": "strong"}]'::jsonb,
   'Timing objection often masks price. Connect delay to real cost. Always ask ''what changes next month?''',
   'system')

ON CONFLICT (org_id, label) DO NOTHING;

SELECT 'Seed data complete — master rubric v1 + 5 core objections' as status;
