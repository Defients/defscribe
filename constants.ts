

import { type Emotion } from './types';

export const FILLER_WORDS: Set<string> = new Set([
  "um", "uh", "like", "you know", "sort of", "kind of", "basically",
  "actually", "literally", "anyway", "so", "well", "right", "i mean",
  "just", "yeah", "hmm", "erm", "mmm", "okay"
]);

export const STOP_WORDS: Set<string> = new Set([
  "the", "and", "that", "have", "for", "not", "with", "you", "this",
  "but", "from", "they", "would", "there", "their", "what", "about",
  "which", "when", "will", "more", "your", "said", "could", "been",
  "some", "were", "then", "than", "them", "into", "only", "just"
]);

export const THEME_PRESETS: { [key: number]: { primary: string; secondary:string; accent: string } } = {
  1: { primary: "#4d8aff", secondary: "#a777ff", accent: "#ffc94d" }, // CosmoTech Default
  2: { primary: "#4dffd4", secondary: "#4d8aff", accent: "#ff6b6b" }, // Cyan Nebula
  3: { primary: "#a777ff", secondary: "#ff6b6b", accent: "#4dffd4" }, // Violet Flare
  4: { primary: "#ffbe0b", secondary: "#4d8aff", accent: "#ff6b6b" }, // Gold Supernova
  5: { primary: "#ff6b6b", secondary: "#a777ff", accent: "#ffc94d" }  // Crimson Void
};

export const AVATAR_EMOTIONS: Record<Emotion, string> = {
  normal: "https://static.wixstatic.com/media/2ef790_9217a67fd8924943b7515c27d417d8b8~mv2.png",
  talking: "https://static.wixstatic.com/media/2ef790_8b2bd3c9b70b42cd88001ecc85f73443~mv2.png",
  thinking: "https://static.wixstatic.com/media/2ef790_06413c4cd25240b6a28dd9b3311734b4~mv2.png",
  happy: "https://static.wixstatic.com/media/2ef790_fa611e0754de4fdbb4e59651bae7d6d4~mv2.png",
  sad: "https://static.wixstatic.com/media/2ef790_6def4ffa92604f99b5e9a72edef88677~mv2.png",
  surprised: "https://static.wixstatic.com/media/2ef790_245704eaf17647ae8efd2d1843aa6cd4~mv2.png",
  confused: "https://static.wixstatic.com/media/2ef790_ee3278e7ba5b46e5b1de3c9ca58eae7d~mv2.png",
  listening: "https://static.wixstatic.com/media/2ef790_1aaa9449c25b4859a4c3c0072ca74b81~mv2.png"
};

export const EMOTION_ICON_MAP: Record<Emotion, string> = {
  normal: "fa-smile-beam",
  talking: "fa-comment-dots",
  thinking: "fa-brain",
  happy: "fa-grin-beam",
  sad: "fa-sad-tear",
  surprised: "fa-surprise",
  confused: "fa-dizzy",
  listening: "fa-headphones",
};

export const DIARIZATION_PALETTE: string[] = ["#7dd3fc","#a78bfa","#fca5a5","#86efac","#fcd34d","#f9a8d4"];