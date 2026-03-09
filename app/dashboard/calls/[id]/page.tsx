import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  Play, 
  User, 
  Calendar, 
  Hash, 
  Flag, 
  CheckCircle, 
  AlertCircle,
  Clock,
  ExternalLink
} from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CallDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  
  if (!user || !user.rep) {
    return null;
  }
  
  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();
  
  // Fetch call with all related data
  const { data: call } = await supabase
    .from("calls")
    .select(`
      *,
      reps!left(id, name, role),
      call_scores(*)
    `)
    .eq("id", id)
    .eq("org_id", orgId)
    .single();
  
  if (!call) {
    notFound();
  }
  
  // Check if flagged
  const { data: flag } = await supabase
    .from("flags")
    .select("note, type")
    .eq("call_id", id)
    .eq("org_id", orgId)
    .single();
  
  const isFlagged = !!flag;
  const repName = call.reps?.name || "Unassigned";
  const repRole = call.reps?.role;
  
  // Get score data
  const scores = call.call_scores;
  const overallScore = scores?.overall_score;
  const isScored = overallScore !== null && overallScore !== undefined;
  const rubricType = scores?.rubric_type || "generic";
  
  // Get category scores based on rubric
  const getCategoryScores = () => {
    if (!scores) return [];
    
    const common = [
      { name: "Opening", score: scores.opening_score },
      { name: "Rapport", score: scores.rapport_score },
      { name: "Structure", score: scores.structure_score },
    ];
    
    if (rubricType === "closer") {
      return [
        ...common,
        { name: "Discovery", score: scores.discovery_score },
        { name: "Credit Expertise", score: scores.credit_expertise_score },
        { name: "Value Explanation", score: scores.value_explanation_score },
        { name: "Objection Handling", score: scores.objection_handling_score },
        { name: "Close Attempt", score: scores.close_attempt_score },
        { name: "Product Knowledge", score: scores.product_knowledge_score },
      ];
    } else if (rubricType === "sdr") {
      return [
        ...common,
        { name: "Qualification", score: scores.qualification_score },
        { name: "Curiosity/Probing", score: scores.curiosity_probing_score },
        { name: "Agenda Control", score: scores.agenda_control_score },
        { name: "Booking Quality", score: scores.booking_quality_score },
        { name: "Urgency", score: scores.urgency_score },
        { name: "Communication Clarity", score: scores.communication_clarity_score },
      ];
    }
    
    return [
      ...common,
      { name: "Discovery", score: scores.discovery_score },
      { name: "Objection Handling", score: scores.objection_handling_score },
      { name: "Closing", score: scores.closing_score },
      { name: "Product Knowledge", score: scores.product_knowledge_score },
    ];
  };
  
  const categoryScores = getCategoryScores().filter(c => c.score !== null && c.score !== undefined);
  
  // Parse strengths/improvements
  const strengths = scores?.strengths 
    ? (typeof scores.strengths === 'string' ? JSON.parse(scores.strengths) : scores.strengths)
    : [];
  const improvements = scores?.improvements
    ? (typeof scores.improvements === 'string' ? JSON.parse(scores.improvements) : scores.improvements)
    : [];
  
  // Format duration
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link 
        href="/dashboard/calls"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to calls
      </Link>      
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white">{call.title || "Untitled Call"}</h1>            
            <StatusBadge 
              isScored={isScored} 
              isFlagged={isFlagged}
              source={call.source}
            />
          </div>          
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <User className="w-4 h-4" />              <span className="text-zinc-300">{repName}</span>              
              {repRole && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  repRole === 'closer' 
                    ? "bg-blue-500/20 text-blue-400" 
                    : "bg-purple-500/20 text-purple-400"
                }`}>
                  {repRole.toUpperCase()}
                </span>
              )}
            </span>            
            
            <span className="flex items-center gap-1.5 text-zinc-500">
              <Calendar className="w-4 h-4" />              
              {new Date(call.created_at).toLocaleString()}
            </span>            
            
            {call.duration_seconds && (
              <span className="flex items-center gap-1.5 text-zinc-500">
                <Clock className="w-4 h-4" />                
                {formatDuration(call.duration_seconds)}
              </span>
            )}            
            
            {call.fathom_call_id && (
              <span className="flex items-center gap-1.5 text-zinc-600 font-mono text-xs">
                <Hash className="w-4 h-4" />                
                {call.fathom_call_id}
              </span>
            )}
          </div>          
          
          {isFlagged && flag.note && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <Flag className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-300">{flag.note}</span>
            </div>
          )}
        </div>        
        <div className="flex items-center">
          {isScored ? (
            <div className="text-center">
              <div className={`text-5xl font-bold ${
                overallScore >= 8 ? "text-green-400" : 
                overallScore < 7 ? "text-red-400" : 
                "text-white"
              }`}>
                {overallScore.toFixed(1)}
              </div>              
              <p className="text-sm text-zinc-500 mt-1">Overall Score</p>              
              <p className="text-xs text-zinc-600 capitalize">{rubricType} rubric</p>
            </div>
          ) : (
            <div className="text-center px-6">
              <div className="text-3xl font-bold text-zinc-600">-</div>              
              <p className="text-sm text-zinc-500 mt-1">Not scored</p>
            </div>
          )}
        </div>
      </div>      
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Recording */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            {call.video_url || call.recording_url ? (
              <video 
                src={call.video_url || call.recording_url} 
                controls 
                className="w-full aspect-video"
              >
                Your browser does not support video.
              </video>
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center bg-zinc-950">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-3">
                  <Play className="w-8 h-8 text-zinc-600" />
                </div>                
                <p className="text-zinc-500">No recording available</p>                
                {call.fathom_call_id && (
                  <a 
                    href={`https://fathom.video/call/${call.fathom_call_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    View in Fathom
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>          
          
          {/* Transcript */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Transcript</h3>            
            {call.transcript ? (
              <pre className="whitespace-pre-wrap text-sm text-zinc-300 leading-relaxed">
                {call.transcript}
              </pre>
            ) : (
              <p className="text-zinc-500">No transcript available</p>
            )}
          </div>
        </div>        
        <div className="space-y-6">
          {/* Score Breakdown */}
          {categoryScores.length > 0 && (
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
              <h3 className="text-lg font-semibold text-white mb-4">Score Breakdown</h3>              
              <div className="space-y-2">
                {categoryScores.map(({ name, score }) => (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-zinc-400">{name}</span>                      
                      <span className="text-sm font-medium text-white">{score}</span>
                    </div>                    
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full" 
                        style={{ width: `${(score / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>            </div>
          )}          
          
          {/* AI Summary */}
          {scores?.ai_summary && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-indigo-300 mb-3">AI Summary</h3>              
              <p className="text-sm text-indigo-200 leading-relaxed">{scores.ai_summary}</p>            </div>
          )}          
          
          {/* Coaching Recommendation */}
          {scores?.coaching_recommendation && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-amber-300 mb-3">Coaching Focus</h3>              
              <p className="text-sm text-amber-200">{scores.coaching_recommendation}</p>            </div>
          )}          
          
          {/* Strengths */}
          {strengths.length > 0 && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-green-300 mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />                
                Strengths
              </h3>              
              <ul className="space-y-2">
                {strengths.map((s: string, i: number) => (
                  <li key={i} className="text-sm text-green-200 flex items-start gap-2">
                    <span className="text-green-400">+</span>                    
                    {s}
                  </li>
                ))}
              </ul>            </div>
          )}          
          
          {/* Improvements */}
          {improvements.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-amber-300 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />                
                Areas for Improvement
              </h3>              
              <ul className="space-y-2">
                {improvements.map((imp: string, i: number) => (
                  <li key={i} className="text-sm text-amber-200 flex items-start gap-2">
                    <span className="text-amber-400">↑</span>                    
                    {imp}
                  </li>
                ))}
              </ul>            </div>
          )}
        </div>
      </div>      
      
      {/* Admin-only raw data */}
      {user.rep?.role === "admin" && call.metadata && (
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
          <details>
            <summary className="text-sm text-zinc-500 cursor-pointer hover:text-zinc-400">
              Raw Metadata (Admin Only)
            </summary>            
            <pre className="mt-3 text-xs text-zinc-600 overflow-auto">
              {JSON.stringify(call.metadata, null, 2)}
            </pre>          
          </details>        
        </div>
      )}
    </div>
  );
}

function StatusBadge({ 
  isScored, 
  isFlagged,
  source 
}: { 
  isScored: boolean; 
  isFlagged: boolean;
  source: string;
}) {
  if (isFlagged) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-500/20 text-red-400 text-xs font-semibold rounded-full">
        <Flag className="w-3 h-3" />        
        Flagged
      </span>
    );
  }  
  
  if (source === "demo") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-800 text-zinc-400 text-xs font-semibold rounded-full">
        Demo
      </span>
    );
  }
  
  if (isScored) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full">
        <CheckCircle className="w-3 h-3" />        
        Scored
      </span>
    );
  }  
  
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-800 text-zinc-500 text-xs font-semibold rounded-full">
      <AlertCircle className="w-3 h-3" />      
      Not Scored
    </span>
  );
}
