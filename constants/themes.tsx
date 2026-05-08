export interface ThemePreset {
  id: string;
  name: string;
  glowColor: string;
  videoFile: string | null;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'apex', name: 'APEX', glowColor: '#00FBFF', videoFile: null },
  { id: 'cyberpunk', name: 'Cyberpunk', glowColor: '#00BFFF', videoFile: '/videos/video1.mp4' },
  { id: 'blood_moon', name: 'Blood Moon', glowColor: '#FF3366', videoFile: '/videos/video4.mp4' },
  { id: 'matrix', name: 'Matrix', glowColor: '#00FF88', videoFile: '/videos/video2.mp4' },
  { id: 'royal', name: 'Royal', glowColor: '#FFD700', videoFile: '/videos/video3.mp4' },
  { id: 'phantom', name: 'Phantom', glowColor: '#A855F7', videoFile: '/videos/video8.mp4' },
  { id: 'inferno', name: 'Inferno', glowColor: '#FF6B00', videoFile: '/videos/video9.mp4' },
  { id: 'neon_rose', name: 'Neon Rose', glowColor: '#FF00FF', videoFile: '/videos/video5.mp4' },
  { id: 'stealth', name: 'Stealth', glowColor: '#00BFFF', videoFile: null },
];

export default THEME_PRESETS;
