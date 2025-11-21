import { cn } from "@/lib/utils";

export function SafeCard({ title, children, className, variant = "default" }: any) {
  const variants = {
    default: "bg-white border border-gray-200 shadow-sm",
    glass: "bg-white/80 backdrop-blur-md border border-white/20 shadow-lg",
    error: "bg-red-50 border border-red-200",
    success: "bg-green-50 border border-green-200"
  };

  return (
    <div className={cn("rounded-xl p-5 transition-all", variants[variant as keyof typeof variants], className)}>
      {title && <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{title}</h3>}
      <div className="space-y-2">{children}</div>
    </div>
  );
}
