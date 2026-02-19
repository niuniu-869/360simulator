import { useMemo } from 'react';
import type { SolarTerm, ParticleType } from '@/data/streetviewData';
import './streetview.css';

interface WeatherParticlesProps {
  solarTerm: SolarTerm;
}

interface Particle {
  id: number;
  left: number;    // % position
  delay: number;   // animation-delay seconds
  duration: number; // animation-duration seconds
  size: number;    // px
  opacity: number;
}

function generateParticles(type: ParticleType, intensity: number): Particle[] {
  if (type === 'none' || intensity === 0) return [];
  const count = intensity * 6;
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 5,
    duration: type === 'mist' ? 8 + Math.random() * 6
      : type === 'fireflies' ? 3 + Math.random() * 4
      : type === 'heat' ? 2 + Math.random() * 3
      : type === 'frost' ? 2 + Math.random() * 4
      : 1.5 + Math.random() * 2.5,
    size: type === 'mist' ? 40 + Math.random() * 60
      : type === 'heat' ? 30 + Math.random() * 50
      : type === 'snow' ? 2 + Math.random() * 3
      : type === 'rain' ? 1
      : type === 'fireflies' ? 2 + Math.random() * 2
      : type === 'frost' ? 1.5 + Math.random() * 2
      : 3 + Math.random() * 3, // petals, leaves
    opacity: type === 'mist' ? 0.15 + Math.random() * 0.1
      : type === 'heat' ? 0.1 + Math.random() * 0.1
      : 0.6 + Math.random() * 0.4,
  }));
}

function getParticleStyle(p: Particle, type: ParticleType): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    left: `${p.left}%`,
    top: type === 'frost' ? `${20 + Math.random() * 60}%` : '-5%',
    animationDelay: `${p.delay}s`,
    animationDuration: `${p.duration}s`,
    opacity: p.opacity,
    pointerEvents: 'none',
  };

  switch (type) {
    case 'rain':
      return { ...base, width: '1px', height: `${6 + p.size * 2}px`, background: 'rgba(147,197,253,0.5)' };
    case 'snow':
      return { ...base, width: `${p.size}px`, height: `${p.size}px`, borderRadius: '50%', background: 'rgba(255,255,255,0.8)' };
    case 'petals':
      return { ...base, width: `${p.size}px`, height: `${p.size}px`, borderRadius: '50% 0', background: 'rgba(251,191,207,0.7)' };
    case 'leaves':
      return { ...base, fontSize: `${8 + p.size}px`, lineHeight: 1 };
    case 'fireflies':
      return { ...base, width: `${p.size}px`, height: `${p.size}px`, borderRadius: '50%', background: 'rgba(253,224,71,0.8)', boxShadow: '0 0 4px rgba(253,224,71,0.6)', top: `${10 + Math.random() * 70}%` };
    case 'mist':
      return { ...base, width: `${p.size}px`, height: `${p.size * 0.3}px`, borderRadius: '50%', background: 'rgba(148,163,184,0.15)', filter: 'blur(8px)', top: `${20 + Math.random() * 50}%` };
    case 'heat':
      return { ...base, width: `${p.size}px`, height: '2px', background: 'transparent', borderBottom: '1px solid rgba(251,146,60,0.08)', filter: 'blur(1px)', top: `${30 + Math.random() * 40}%` };
    case 'frost':
      return { ...base, width: `${p.size}px`, height: `${p.size}px`, borderRadius: '50%', background: 'rgba(224,242,254,0.5)' };
    default:
      return base;
  }
}

export function WeatherParticles({ solarTerm }: WeatherParticlesProps) {
  const { particleType, particleIntensity } = solarTerm;

  const particles = useMemo(
    () => generateParticles(particleType, particleIntensity),
    [particleType, particleIntensity]
  );

  if (particleType === 'none' || particles.length === 0) return null;

  const cssClass = `sv-particle-${particleType}`;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <div
          key={p.id}
          className={cssClass}
          style={getParticleStyle(p, particleType)}
        >
          {particleType === 'leaves' ? '🍂' : null}
        </div>
      ))}
    </div>
  );
}
