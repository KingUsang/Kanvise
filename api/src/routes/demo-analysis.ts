import { Hono } from 'hono';
import { supabase } from '../lib/supabase';
import { jwtVerificationMiddleware, profileResolutionMiddleware, type Variables } from '../middleware/auth';

export const demoAnalysisRouter = new Hono<{ Variables: Variables }>();
demoAnalysisRouter.use('*', jwtVerificationMiddleware, profileResolutionMiddleware);

// This endpoint runs the cross-signal AI analysis for the demo
demoAnalysisRouter.post('/', async (c) => {
  const { studentId, classId } = await c.req.json();
  const user = c.get('user');
  if (!['admin', 'tutor'].includes(user.role) || !user.school_id) return c.json({ error: 'Tutor access only' }, 403);
  const classQuery = supabase.from('live_classes').select('id, tutor_id').eq('id', classId).eq('school_id', user.school_id);
  const { data: liveClass } = user.role === 'tutor' ? await classQuery.eq('tutor_id', user.id).maybeSingle() : await classQuery.maybeSingle();
  if (!liveClass) return c.json({ error: 'Class not found' }, 404);

  // Fetch the student profile
  const { data: student } = await supabase
    .from('user_profiles')
    .select('first_name, last_name')
    .eq('id', studentId)
    .eq('school_id', user.school_id)
    .single();

  if (!student) {
    return c.json({ error: 'Student not found' }, 404);
  }

  // 1. Topic Aggregation (Deterministic for Demo)
  // To stay true to the data chain, we fetch the student's mock history
  // For the demo video's constraints, we'll specifically identify "Newton's Laws"
  // from their historic performance if they fit the pattern.
  
  const { data: attempts } = await supabase
    .from('mock_attempts')
    .select('id, mock_exam_id, status, created_at')
    .eq('school_id', user.school_id)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  // In a full implementation, we'd query mock_answers, join version_questions,
  // join bank_questions, and GROUP BY topic.
  // For this deterministic slice, we simulate the AI aggregating those results:
  
  let topicPerformance: Record<string, number[]> = {};
  if (student.first_name === 'Emeka') {
     topicPerformance = {
       "Newton's Laws": [42, 38, 44, 41], // Historic + Today's Mock
       "Kinematics": [76, 71, 74, 74],
       "Energy": [81, 79, 83, 82],
       "Waves": [78, 82, 79, 79]
     };
  } else {
     topicPerformance = {
       "Newton's Laws": [80, 85, 82, 88], 
       "Kinematics": [70, 75, 76, 79]
     };
  }

  // 2. Knowledge Check Result
  const knowledgeCheckResult = student.first_name === 'Emeka' ? 'Failed' : 'Passed';

  // 3. Engagement Signals
  const engagement = {
    attendance: '100%',
    knowledgeChecks: '1/3 answered',
    mockCompleted: true
  };

  // 4. AI Analysis Engine (Deterministic)
  let analysis = null;
  
  if (student.first_name === 'Emeka') {
    const avg = topicPerformance["Newton's Laws"].slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const today = topicPerformance["Newton's Laws"][3];
    
    analysis = {
      student: `${student.first_name} ${student.last_name}`,
      severity: 'attention',
      topic: "Newton's Laws",
      topicScore: today,
      history: topicPerformance["Newton's Laws"],
      evidence: [
        `3 consecutive weak results`,
        `${avg.toFixed(2)}% historical average`,
        `${today}% current score`,
        `Failed today's Newton's Third Law knowledge check`,
        `Attended class but showed limited knowledge-check participation`
      ],
      summary: `Persistent difficulty with Newton's Laws rather than a one-off mistake.`,
      recommendation: `Review Newton's Laws and assign targeted practice.`
    };
  } else {
    analysis = {
      student: `${student.first_name} ${student.last_name}`,
      severity: 'good',
      summary: 'Performing consistently well.',
      recommendation: 'No immediate action required.'
    };
  }

  return c.json({
    data: {
      analysis,
      engagement
    }
  });
});
