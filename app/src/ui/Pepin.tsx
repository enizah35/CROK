import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { PEPIN_ETATS, type PepinEtat } from '@crok/shared';

import { pepinColors as c } from './tokens';

/**
 * États de Pépin (R-30) : la liste et le calcul (`pepinEtatFromProgress`) vivent dans
 * `@crok/shared` ; ce composant ne fait que dessiner l'état reçu. Réexportés ici pour `@/ui`.
 */
export { PEPIN_ETATS, type PepinEtat };

/** Libellés lus par les lecteurs d'écran. Ton bienveillant, jamais culpabilisant (R-31). */
export const PEPIN_LABELS: Record<PepinEtat, string> = {
  neutre: 'Pépin la tomate, tranquille',
  motive: 'Pépin la tomate, motivé',
  affame: 'Pépin la tomate, affamé',
  en_feu: 'Pépin la tomate, en feu',
  fier: 'Pépin la tomate, fier de toi',
  fete: 'Pépin la tomate, fait la fête',
};

export type PepinProps = {
  etat: PepinEtat;
  /** Côté du carré en points. */
  taille?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const EYE_L = 46;
const EYE_R = 74;
const EYE_Y = 70;

const stroke = { stroke: c.face, strokeWidth: 3.5, strokeLinecap: 'round', fill: 'none' } as const;

function DotEyes({ r = 4.5, glint = false }: { r?: number; glint?: boolean }) {
  return (
    <G>
      <Circle cx={EYE_L} cy={EYE_Y} r={r} fill={c.face} />
      <Circle cx={EYE_R} cy={EYE_Y} r={r} fill={c.face} />
      {glint ? (
        <G>
          <Circle cx={EYE_L + 1.5} cy={EYE_Y - 1.5} r={1.4} fill="#FFFFFF" />
          <Circle cx={EYE_R + 1.5} cy={EYE_Y - 1.5} r={1.4} fill="#FFFFFF" />
        </G>
      ) : null}
    </G>
  );
}

/** Yeux fermés en arc (^ ^) : joie, fierté. */
function HappyEyes() {
  return (
    <G>
      <Path
        d={`M${EYE_L - 6} ${EYE_Y + 2} Q${EYE_L} ${EYE_Y - 7} ${EYE_L + 6} ${EYE_Y + 2}`}
        {...stroke}
      />
      <Path
        d={`M${EYE_R - 6} ${EYE_Y + 2} Q${EYE_R} ${EYE_Y - 7} ${EYE_R + 6} ${EYE_Y + 2}`}
        {...stroke}
      />
    </G>
  );
}

function Cheeks() {
  return (
    <G>
      <Ellipse cx={EYE_L - 8} cy={EYE_Y + 10} rx={6} ry={3.5} fill={c.cheek} />
      <Ellipse cx={EYE_R + 8} cy={EYE_Y + 10} rx={6} ry={3.5} fill={c.cheek} />
    </G>
  );
}

function Face({ etat }: { etat: PepinEtat }): ReactNode {
  switch (etat) {
    case 'neutre':
      return (
        <G testID="pepin-visage-neutre">
          <DotEyes />
          <Path d="M52 88 Q60 91 68 88" {...stroke} />
        </G>
      );
    case 'motive':
      return (
        <G testID="pepin-visage-motive">
          <Path
            d={`M${EYE_L - 6} ${EYE_Y - 10} Q${EYE_L} ${EYE_Y - 14} ${EYE_L + 6} ${EYE_Y - 10}`}
            {...stroke}
            strokeWidth={3}
          />
          <Path
            d={`M${EYE_R - 6} ${EYE_Y - 10} Q${EYE_R} ${EYE_Y - 14} ${EYE_R + 6} ${EYE_Y - 10}`}
            {...stroke}
            strokeWidth={3}
          />
          <DotEyes r={5} glint />
          <Cheeks />
          <Path d="M48 85 Q60 97 72 85" {...stroke} />
        </G>
      );
    case 'affame':
      return (
        <G testID="pepin-visage-affame">
          {/* Regard tourné vers le haut, comme vers le frigo. */}
          <Circle cx={EYE_L} cy={EYE_Y} r={6.5} fill="#FFFFFF" stroke={c.face} strokeWidth={2} />
          <Circle cx={EYE_R} cy={EYE_Y} r={6.5} fill="#FFFFFF" stroke={c.face} strokeWidth={2} />
          <Circle cx={EYE_L + 1} cy={EYE_Y - 2.5} r={3} fill={c.face} />
          <Circle cx={EYE_R + 1} cy={EYE_Y - 2.5} r={3} fill={c.face} />
          <Ellipse cx={60} cy={90} rx={7} ry={8} fill={c.face} />
          <Ellipse cx={60} cy={94} rx={4.5} ry={3} fill={c.cheek} />
          {/* Goutte de salive. */}
          <Path d="M70 92 Q73 98 70 101 Q67 98 70 92 Z" fill="#8FD3F4" />
        </G>
      );
    case 'en_feu':
      return (
        <G testID="pepin-visage-en_feu">
          <Path d={`M${EYE_L - 7} ${EYE_Y - 12} L${EYE_L + 6} ${EYE_Y - 7}`} {...stroke} />
          <Path d={`M${EYE_R + 7} ${EYE_Y - 12} L${EYE_R - 6} ${EYE_Y - 7}`} {...stroke} />
          <DotEyes r={5} glint />
          <Path d="M45 84 Q60 102 75 84 Z" fill={c.face} />
          <Path d="M49 85.5 L71 85.5 L69 89 L51 89 Z" fill="#FFFFFF" />
        </G>
      );
    case 'fier':
      return (
        <G testID="pepin-visage-fier">
          <HappyEyes />
          <Cheeks />
          <Path d="M48 86 Q60 96 72 86" {...stroke} />
          {/* Petite étincelle de fierté. */}
          <Path d="M96 50 L98 56 L104 58 L98 60 L96 66 L94 60 L88 58 L94 56 Z" fill={c.hat} />
        </G>
      );
    case 'fete':
      return (
        <G testID="pepin-visage-fete">
          <HappyEyes />
          <Cheeks />
          <Path d="M46 83 Q60 104 74 83 Z" fill={c.face} />
          <Ellipse cx={60} cy={93} rx={6} ry={3.5} fill={c.cheek} />
        </G>
      );
  }
}

function Flames() {
  return (
    <G testID="pepin-flammes">
      <Path d="M60 2 C72 16 82 22 78 56 L42 56 C38 22 48 16 60 2 Z" fill={c.flameOuter} />
      <Path d="M34 14 C42 24 46 30 46 58 L30 58 C26 30 30 22 34 14 Z" fill={c.flameOuter} />
      <Path d="M86 14 C90 22 94 30 90 58 L74 58 C74 30 78 24 86 14 Z" fill={c.flameOuter} />
      <Path d="M60 14 C66 22 70 28 67 40 L53 40 C50 28 54 22 60 14 Z" fill={c.flameInner} />
    </G>
  );
}

function PartyHat() {
  return (
    <G testID="pepin-chapeau">
      {/* Confettis. */}
      <Rect x={10} y={20} width={6} height={10} rx={1} fill={c.confetti[0]} />
      <Rect x={100} y={16} width={6} height={10} rx={1} fill={c.confetti[1]} />
      <Rect x={18} y={44} width={5} height={8} rx={1} fill={c.confetti[2]} />
      <Rect x={98} y={42} width={5} height={8} rx={1} fill={c.confetti[3]} />
      <Circle cx={30} cy={10} r={3} fill={c.confetti[2]} />
      <Circle cx={90} cy={6} r={3} fill={c.confetti[0]} />
      {/* Chapeau pointu. */}
      <Path d="M60 4 L76 38 L44 38 Z" fill={c.hat} />
      <Path d="M52 21 L68 21 L71 28 L49 28 Z" fill={c.hatStripe} />
      <Circle cx={60} cy={4} r={4.5} fill={c.confetti[3]} />
    </G>
  );
}

/**
 * Pépin provisoire : une tomate en SVG dont le visage change selon l'état (R-30).
 * À remplacer par de vraies illustrations (tâche 3.1) sans changer l'API.
 */
export function Pepin({ etat, taille = 96, accessibilityLabel, style, testID }: PepinProps) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? PEPIN_LABELS[etat]}
      testID={testID ?? `pepin-${etat}`}
      style={[{ width: taille, height: taille }, style]}
    >
      <Svg width={taille} height={taille} viewBox="0 0 120 120">
        {etat === 'en_feu' ? <Flames /> : null}
        {/* Corps de la tomate. */}
        <Ellipse cx={60} cy={76} rx={46} ry={40} fill={c.body} />
        <Path
          d="M22 92 Q60 128 98 92 Q90 116 60 116 Q30 116 22 92 Z"
          fill={c.bodyShade}
          opacity={0.6}
        />
        <Ellipse cx={36} cy={58} rx={9} ry={6} fill={c.highlight} opacity={0.8} />
        {/* Tige et feuilles. */}
        <Path
          d="M60 46 L46 38 L54 46 L40 50 L56 50 L60 58 L64 50 L80 50 L66 46 L74 38 Z"
          fill={c.stem}
          stroke={c.stemDark}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <Rect x={57.5} y={32} width={5} height={14} rx={2.5} fill={c.stemDark} />
        {etat === 'fete' ? <PartyHat /> : null}
        <Face etat={etat} />
      </Svg>
    </View>
  );
}
