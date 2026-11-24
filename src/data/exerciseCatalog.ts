import { Exercise, MuscleGroup } from '../types/workout';

interface SeedExercise {
  id: string;
  name: string;
  category: MuscleGroup;
}

const SEED_EXERCISES: SeedExercise[] = [
  // CHEST
  { id: 'builtin-chest-bench-press', name: 'Barbell Bench Press', category: 'CHEST' },
  { id: 'builtin-chest-incline-db-press', name: 'Incline Dumbbell Press', category: 'CHEST' },
  { id: 'builtin-chest-flat-db-press', name: 'Flat Dumbbell Press', category: 'CHEST' },
  { id: 'builtin-chest-incline-barbell', name: 'Incline Barbell Press', category: 'CHEST' },
  { id: 'builtin-chest-cable-fly', name: 'Cable Chest Fly', category: 'CHEST' },
  { id: 'builtin-chest-pec-deck', name: 'Pec Deck Machine', category: 'CHEST' },
  { id: 'builtin-chest-dips', name: 'Weighted Chest Dips', category: 'CHEST' },
  { id: 'builtin-chest-machine-press', name: 'Chest Press Machine', category: 'CHEST' },
  { id: 'builtin-chest-pushups', name: 'Push-Ups', category: 'CHEST' },

  // BACK
  { id: 'builtin-back-deadlift', name: 'Barbell Deadlift', category: 'BACK' },
  { id: 'builtin-back-pullups', name: 'Pull-Ups', category: 'BACK' },
  { id: 'builtin-back-lat-pulldown', name: 'Lat Pulldown', category: 'BACK' },
  { id: 'builtin-back-barbell-row', name: 'Barbell Bent-Over Row', category: 'BACK' },
  { id: 'builtin-back-seated-cable-row', name: 'Seated Cable Row', category: 'BACK' },
  { id: 'builtin-back-db-row', name: 'Single-Arm Dumbbell Row', category: 'BACK' },
  { id: 'builtin-back-tbar-row', name: 'T-Bar Row', category: 'BACK' },
  { id: 'builtin-back-chest-supported-row', name: 'Chest-Supported Row', category: 'BACK' },
  { id: 'builtin-back-straight-arm-pulldown', name: 'Straight-Arm Pulldown', category: 'BACK' },

  // SHOULDERS
  { id: 'builtin-shoulders-ohp', name: 'Overhead Barbell Press', category: 'SHOULDERS' },
  { id: 'builtin-shoulders-db-press', name: 'Seated Dumbbell Shoulder Press', category: 'SHOULDERS' },
  { id: 'builtin-shoulders-lateral-raise', name: 'Dumbbell Lateral Raise', category: 'SHOULDERS' },
  { id: 'builtin-shoulders-cable-lateral', name: 'Cable Lateral Raise', category: 'SHOULDERS' },
  { id: 'builtin-shoulders-face-pull', name: 'Cable Face Pull', category: 'SHOULDERS' },
  { id: 'builtin-shoulders-rear-delt-fly', name: 'Reverse Pec Deck / Rear Delt Fly', category: 'SHOULDERS' },
  { id: 'builtin-shoulders-arnold-press', name: 'Arnold Press', category: 'SHOULDERS' },
  { id: 'builtin-shoulders-front-raise', name: 'Front Raise', category: 'SHOULDERS' },
  { id: 'builtin-shoulders-shrugs', name: 'Barbell / Dumbbell Shrugs', category: 'SHOULDERS' },

  // LEGS
  { id: 'builtin-legs-back-squat', name: 'Barbell Back Squat', category: 'LEGS' },
  { id: 'builtin-legs-front-squat', name: 'Barbell Front Squat', category: 'LEGS' },
  { id: 'builtin-legs-rdl', name: 'Romanian Deadlift (RDL)', category: 'LEGS' },
  { id: 'builtin-legs-leg-press', name: 'Leg Press', category: 'LEGS' },
  { id: 'builtin-legs-hack-squat', name: 'Hack Squat', category: 'LEGS' },
  { id: 'builtin-legs-bulgarian-split', name: 'Bulgarian Split Squat', category: 'LEGS' },
  { id: 'builtin-legs-leg-extension', name: 'Leg Extension', category: 'LEGS' },
  { id: 'builtin-legs-leg-curl', name: 'Seated / Lying Leg Curl', category: 'LEGS' },
  { id: 'builtin-legs-calf-raise', name: 'Standing Calf Raise', category: 'LEGS' },
  { id: 'builtin-legs-hip-thrust', name: 'Barbell Hip Thrust', category: 'LEGS' },

  // ARMS
  { id: 'builtin-arms-barbell-curl', name: 'Barbell / EZ-Bar Curl', category: 'ARMS' },
  { id: 'builtin-arms-db-curl', name: 'Incline Dumbbell Curl', category: 'ARMS' },
  { id: 'builtin-arms-hammer-curl', name: 'Hammer Curl', category: 'ARMS' },
  { id: 'builtin-arms-preacher-curl', name: 'Preacher Curl', category: 'ARMS' },
  { id: 'builtin-arms-tricep-pushdown', name: 'Cable Tricep Pushdown', category: 'ARMS' },
  { id: 'builtin-arms-overhead-tricep', name: 'Overhead Tricep Extension', category: 'ARMS' },
  { id: 'builtin-arms-skullcrushers', name: 'Skullcrushers', category: 'ARMS' },
  { id: 'builtin-arms-close-grip-bench', name: 'Close-Grip Bench Press', category: 'ARMS' },

  // CORE
  { id: 'builtin-core-hanging-leg-raise', name: 'Hanging Leg Raise', category: 'CORE' },
  { id: 'builtin-core-cable-crunch', name: 'Cable Crunch', category: 'CORE' },
  { id: 'builtin-core-ab-wheel', name: 'Ab Wheel Rollout', category: 'CORE' },
  { id: 'builtin-core-plank', name: 'Weighted Plank (sec)', category: 'CORE' },
  { id: 'builtin-core-pallof-press', name: 'Pallof Press', category: 'CORE' },

  // CARDIO
  { id: 'builtin-cardio-incline-walk', name: 'Incline Treadmill Walk', category: 'CARDIO' },
  { id: 'builtin-cardio-stairmaster', name: 'Stair Climber', category: 'CARDIO' },
  { id: 'builtin-cardio-rower', name: 'Rowing Ergometer', category: 'CARDIO' },
  { id: 'builtin-cardio-assault-bike', name: 'Air Bike Intervals', category: 'CARDIO' },
];

export const BUILTIN_EXERCISES: Exercise[] = SEED_EXERCISES.map((item) => ({
  ...item,
  isCustom: false,
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  syncStatus: 'synced',
}));
