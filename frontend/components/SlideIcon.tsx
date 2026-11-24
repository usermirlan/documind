import {
  Award, BookOpen, Briefcase, Building2, Calendar, Camera, ChartLine, CircleCheck, Clock, Coins, Compass, Cpu,
  Database, DollarSign, Flag, Globe, GraduationCap, Handshake, Heart, Layers, Leaf, Lightbulb, Lock, MapPin,
  MessageCircle, Mountain, Music, Plane, Puzzle, Rocket, Settings, ShieldCheck, Smile, Sparkles, Star, Sun,
  Target, TrendingUp, Users, Zap, type LucideIcon,
} from "lucide-react";

// names match backend/app/presentations/schema.py ICONS
const MAP: Record<string, LucideIcon> = {
  rocket: Rocket, target: Target, lightbulb: Lightbulb, users: Users, globe: Globe, chart: ChartLine,
  shield: ShieldCheck, leaf: Leaf, heart: Heart, book: BookOpen, graduation: GraduationCap, briefcase: Briefcase,
  cpu: Cpu, zap: Zap, clock: Clock, calendar: Calendar, "map-pin": MapPin, mountain: Mountain, sun: Sun,
  dollar: DollarSign, "trending-up": TrendingUp, award: Award, check: CircleCheck, star: Star, settings: Settings,
  layers: Layers, message: MessageCircle, handshake: Handshake, building: Building2, flag: Flag, compass: Compass,
  database: Database, lock: Lock, smile: Smile, sparkles: Sparkles, puzzle: Puzzle, coins: Coins, plane: Plane,
  camera: Camera, music: Music,
};

export function hasIcon(name?: string) {
  return !!name && name in MAP;
}

export default function SlideIcon({ name, size, color }: { name: string; size: string; color: string }) {
  const I = MAP[name];
  return I ? <I style={{ width: size, height: size, color }} strokeWidth={2.2} aria-hidden /> : null;
}
