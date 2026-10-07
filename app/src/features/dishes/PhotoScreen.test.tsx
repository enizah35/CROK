import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type * as MockReact from 'react';
import { Linking } from 'react-native';
import type * as MockRN from 'react-native';

import { TestProviders } from '@/features/recipes/testUtils';

import { PhotoScreen } from './PhotoScreen';

const UID = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const RECIPE = '33333333-3333-4333-8333-333333333333';
const DISH = '44444444-4444-4444-8444-444444444444';
// Les octets « préparés » de chaque photo et leur empreinte (voir les mocks plus bas).
const SHA_A = '01'.repeat(32);
const SHA_B = '04'.repeat(32);
const PATH_A = `${UID}/${SESSION}/${SHA_A}.jpg`;
const PATH_B = `${UID}/${SESSION}/${SHA_B}.jpg`;

// --- expo-router ---------------------------------------------------------------------------
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

// --- session de l'utilisateur ----------------------------------------------------------------
let mockUserId: string | null = UID;
jest.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({
    session: mockUserId ? { user: { id: mockUserId } } : null,
    loading: false,
  }),
}));

// --- expo-camera ---------------------------------------------------------------------------
type Permission = { granted: boolean; canAskAgain: boolean } | null;
let mockPermission: Permission = { granted: true, canAskAgain: true };
const mockRequestPermission = jest.fn();
const mockTakePicture = jest.fn();
jest.mock('expo-camera', () => {
  const React = jest.requireActual<typeof MockReact>('react');
  const { View } = jest.requireActual<typeof MockRN>('react-native');
  const CameraView = React.forwardRef<unknown, { onCameraReady?: () => void; testID?: string }>(
    function CameraView(props, ref) {
      React.useImperativeHandle(ref, () => ({
        takePictureAsync: (...args: unknown[]) => mockTakePicture(...args),
      }));
      const { onCameraReady } = props;
      React.useEffect(() => onCameraReady?.(), [onCameraReady]);
      return <View testID={props.testID} />;
    },
  );
  return {
    CameraView,
    useCameraPermissions: () => [mockPermission, mockRequestPermission],
  };
});

// --- préparation : expo-image-manipulator et empreinte (expo-crypto) -------------------------
// Chaque photo prise a sa propre URI ; ses octets préparés sont [1,2,3] (photo A) ou [4,5,6]
// (photo B), et la fausse empreinte répète le premier octet.
const mockBase64ByUri: Record<string, string> = {
  'file:///a.jpg': 'AQID',
  'file:///b.jpg': 'BAUG',
};
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: (uri: string) => {
      const context = {
        resize: () => context,
        renderAsync: async () => ({
          saveAsync: async () => ({ uri: `${uri}.out`, base64: mockBase64ByUri[uri] }),
        }),
      };
      return context;
    },
  },
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: async (_algorithm: string, data: Uint8Array) =>
    new Uint8Array(32).fill(data[0] ?? 0).buffer,
}));

// --- supabase ------------------------------------------------------------------------------
type Result<T> = { data: T | null; error: { message: string; statusCode?: string } | null };
const mockUpload = jest.fn<Promise<Result<unknown>>, unknown[]>();
const mockRpc = jest.fn<Promise<Result<unknown>>, [string, unknown?]>();
const mockUpdate = jest.fn();
const mockUpdateEq = jest.fn<Promise<{ error: unknown }>, unknown[]>();
const mockRecipe = jest.fn<Promise<Result<{ active_min: number }>>, []>();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: { from: () => ({ upload: (...args: unknown[]) => mockUpload(...args) }) },
    rpc: (name: string, args?: unknown) => mockRpc(name, args),
    from: (table: string) =>
      table === 'cook_sessions'
        ? {
            update: (values: unknown) => {
              mockUpdate(values);
              return { eq: (...args: unknown[]) => mockUpdateEq(...args) };
            },
          }
        : { select: () => ({ eq: () => ({ maybeSingle: () => mockRecipe() }) }) },
  },
}));

const ok = <T,>(data: T): Result<T> => ({ data, error: null });
const fail = (message: string, statusCode?: string): Result<never> => ({
  data: null,
  error: statusCode ? { message, statusCode } : { message },
});
const NETWORK = 'TypeError: Network request failed';

function cookResult(overrides: Record<string, unknown> = {}) {
  return {
    dish_id: DISH,
    counted: true,
    xp_awarded: 100,
    week_start: '2026-10-05',
    week_dishes_count: 2,
    goal_reached: false,
    streak: 1,
    lifetime_xp: 700,
    already_completed: false,
    ...overrides,
  };
}

/** Réponses de `complete_cook_session`, dans l'ordre des appels. */
let completeResponses: Result<unknown>[];
let activeSession: Result<unknown>;

let queryClient: QueryClient;

beforeEach(() => {
  mockReplace.mockReset();
  mockUserId = UID;
  mockPermission = { granted: true, canAskAgain: true };
  mockRequestPermission.mockReset();
  mockTakePicture.mockReset().mockResolvedValue({ uri: 'file:///a.jpg', width: 4032 });
  mockUpload.mockReset().mockResolvedValue(ok({ path: PATH_A }));
  mockUpdate.mockReset();
  mockUpdateEq.mockReset().mockResolvedValue({ error: null });
  mockRecipe.mockReset().mockResolvedValue(ok({ active_min: 40 }));
  completeResponses = [ok(cookResult())];
  activeSession = ok(null);
  mockRpc.mockReset().mockImplementation(async (name) => {
    if (name === 'get_active_cook_session') return activeSession;
    if (name === 'complete_cook_session') {
      // La dernière réponse sert pour tous les appels suivants.
      const next = completeResponses.length > 1 ? completeResponses.shift() : completeResponses[0];
      if (!next) throw new Error('aucune réponse prévue');
      return next;
    }
    throw new Error(`rpc inattendue : ${name}`);
  });
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

async function renderScreen({ sessionId }: { sessionId?: string } = { sessionId: SESSION }) {
  await render(
    <QueryClientProvider client={queryClient}>
      <TestProviders>
        <PhotoScreen sessionId={sessionId} />
      </TestProviders>
    </QueryClientProvider>,
  );
}

const button = (name: string) => screen.getByRole('button', { name });
const completeCalls = () => mockRpc.mock.calls.filter(([name]) => name === 'complete_cook_session');

async function takePhoto() {
  await fireEvent.press(button('Prendre la photo'));
  expect(screen.getByTestId('photo-preview')).toBeOnTheScreen();
}

async function takeAndValidate() {
  await takePhoto();
  await fireEvent.press(button('Valider mon plat'));
}

describe('PhotoScreen : capture (R-07)', () => {
  it('appareil photo dans l’app, aperçu puis « Reprendre la photo »', async () => {
    await renderScreen();
    expect(screen.getByTestId('camera')).toBeOnTheScreen();
    expect(screen.queryByText(/galerie/i)).toBeNull();
    await takePhoto();
    expect(mockTakePicture).toHaveBeenCalledTimes(1);
    await fireEvent.press(button('Reprendre la photo'));
    expect(screen.getByTestId('camera')).toBeOnTheScreen();
  });

  it('permission refusée mais redemandable : bouton pour autoriser, « Passer » reste possible', async () => {
    mockPermission = { granted: false, canAskAgain: true };
    await renderScreen();
    expect(screen.queryByTestId('camera')).toBeNull();
    expect(screen.getByText('L’appareil photo est nécessaire')).toBeOnTheScreen();
    await fireEvent.press(button('Autoriser l’appareil photo'));
    expect(mockRequestPermission).toHaveBeenCalled();
    expect(button('Passer')).toBeOnTheScreen();
  });

  it('permission refusée définitivement : renvoi vers les réglages', async () => {
    mockPermission = { granted: false, canAskAgain: false };
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await renderScreen();
    await fireEvent.press(button('Ouvrir les réglages'));
    expect(openSettings).toHaveBeenCalled();
    expect(button('Passer')).toBeOnTheScreen();
  });

  it('sans session dans l’URL : message et retour aux recettes', async () => {
    await renderScreen({});
    expect(screen.getByText('Session introuvable')).toBeOnTheScreen();
    await fireEvent.press(button('Voir les recettes'));
    expect(mockReplace).toHaveBeenCalledWith('/recettes');
  });
});

describe('PhotoScreen : « Passer » (R-07)', () => {
  it('termine la session sans photo, 0 XP, sans appeler complete_cook_session', async () => {
    await renderScreen();
    await fireEvent.press(button('Passer'));
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'terminee_sans_photo' });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', SESSION);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(screen.getByTestId('skipped-screen')).toBeOnTheScreen();
    expect(screen.getByText(/ne compte pas pour ta série/)).toBeOnTheScreen();
    expect(screen.queryByText(/\+\d+ XP/)).toBeNull();
    await fireEvent.press(button('Voir les recettes'));
    expect(mockReplace).toHaveBeenCalledWith('/recettes');
  });

  it('échec réseau sur « Passer » : message, on peut réessayer', async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: { message: NETWORK } });
    await renderScreen();
    await fireEvent.press(button('Passer'));
    expect(screen.getByRole('alert')).toHaveTextContent(/Impossible de passer/);
    await fireEvent.press(button('Passer'));
    expect(screen.getByTestId('skipped-screen')).toBeOnTheScreen();
  });
});

describe('PhotoScreen : validation et récompense (R-08 à R-17)', () => {
  it('plat compté : envoi, validation, +100 XP, x/3, série, Pépin fier', async () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    await renderScreen();
    await takeAndValidate();

    expect(mockUpload).toHaveBeenCalledTimes(1);
    const [path, body, options] = mockUpload.mock.calls[0] ?? [];
    expect(path).toBe(PATH_A);
    expect(Array.from(new Uint8Array(body as ArrayBuffer))).toEqual([1, 2, 3]);
    expect(options).toEqual({ contentType: 'image/jpeg', upsert: false });
    expect(completeCalls()).toEqual([
      [
        'complete_cook_session',
        { p_session_id: SESSION, p_photo_path: PATH_A, p_photo_sha256: SHA_A },
      ],
    ]);

    expect(screen.getByTestId('reward-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('reward-xp')).toHaveTextContent('+100 XP');
    expect(screen.getByLabelText('Série de la semaine : 2 plats sur 3')).toBeOnTheScreen();
    expect(screen.getByTestId('reward-streak')).toHaveTextContent('Série : 1 semaine');
    expect(screen.getByTestId('reward-total')).toHaveTextContent('Total : 700 XP');
    expect(screen.getByTestId('pepin-fier')).toBeOnTheScreen();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['progress'] });

    await fireEvent.press(button('Voir mon profil'));
    expect(mockReplace).toHaveBeenLastCalledWith('/profil');
    await fireEvent.press(button('Voir les recettes'));
    expect(mockReplace).toHaveBeenLastCalledWith('/recettes');
  });

  it('3/3 : objectif atteint et Pépin en feu (R-16)', async () => {
    completeResponses = [ok(cookResult({ week_dishes_count: 3, goal_reached: true, streak: 2 }))];
    await renderScreen();
    await takeAndValidate();
    expect(
      screen.getByLabelText('Objectif de la semaine atteint : 3 plats sur 3'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('pepin-en_feu')).toBeOnTheScreen();
    expect(screen.getByTestId('reward-streak')).toHaveTextContent('Série : 2 semaines');
  });

  it('plat non compté (R-11) : pas d’XP, explication bienveillante', async () => {
    completeResponses = [ok(cookResult({ counted: false, xp_awarded: 0 }))];
    await renderScreen();
    await takeAndValidate();
    expect(screen.getByText('Plat enregistré !')).toBeOnTheScreen();
    expect(screen.queryByTestId('reward-xp')).toBeNull();
    expect(screen.getByTestId('reward-not-counted')).toHaveTextContent(
      /au plus 2 plats par jour, et chaque recette une seule fois par jour/,
    );
  });

  it('réponse mal formée : traitée comme un échec réessayable', async () => {
    completeResponses = [ok({ unexpected: true }), ok(cookResult({ already_completed: true }))];
    await renderScreen();
    await takeAndValidate();
    expect(screen.getByText('La connexion a coincé')).toBeOnTheScreen();
    await fireEvent.press(button('Réessayer'));
    expect(screen.getByTestId('reward-screen')).toBeOnTheScreen();
  });
});

describe('PhotoScreen : pas de doublon en cas d’échec réseau (R-10)', () => {
  it('validation perdue puis réessai : un seul envoi, complete rappelé, already_completed = succès', async () => {
    completeResponses = [
      fail(NETWORK),
      ok(cookResult({ already_completed: true })), // le premier appel avait abouti côté serveur
    ];
    await renderScreen();
    await takeAndValidate();

    expect(screen.getByText('La connexion a coincé')).toBeOnTheScreen();
    // Ni « Passer » ni « Reprendre » : la validation a peut-être abouti.
    expect(screen.queryByRole('button', { name: 'Passer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reprendre la photo' })).toBeNull();

    await fireEvent.press(button('Réessayer'));
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(completeCalls()).toHaveLength(2);
    expect(completeCalls()[1]).toEqual(completeCalls()[0]);
    expect(screen.getByTestId('reward-xp')).toHaveTextContent('+100 XP');
  });

  it('envoi en échec puis réessai : la photo est renvoyée au même chemin', async () => {
    mockUpload.mockResolvedValueOnce(fail(NETWORK));
    await renderScreen();
    await takeAndValidate();
    expect(completeCalls()).toHaveLength(0);
    expect(screen.getByText('La connexion a coincé')).toBeOnTheScreen();
    // Aucun appel de validation : « Passer » reste possible.
    expect(button('Passer')).toBeOnTheScreen();

    await fireEvent.press(button('Réessayer'));
    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(mockUpload.mock.calls[1]?.[0]).toBe(PATH_A);
    expect(completeCalls()).toHaveLength(1);
    expect(screen.getByTestId('reward-screen')).toBeOnTheScreen();
  });

  it('envoi arrivé mais réponse perdue : « existe déjà » (409) compte comme envoyé', async () => {
    mockUpload
      .mockResolvedValueOnce(fail(NETWORK))
      .mockResolvedValueOnce(fail('The resource already exists', '409'));
    await renderScreen();
    await takeAndValidate();
    await fireEvent.press(button('Réessayer'));
    expect(completeCalls()).toHaveLength(1);
    expect(screen.getByTestId('reward-screen')).toBeOnTheScreen();
  });

  it('double appui sur « Valider » : un seul envoi et une seule validation', async () => {
    let release: (value: Result<unknown>) => void = () => undefined;
    mockRpc.mockImplementation(
      (name) =>
        new Promise((resolve) => {
          expect(name).toBe('complete_cook_session');
          release = resolve;
        }),
    );
    await renderScreen();
    await takePhoto();
    const validate = button('Valider mon plat');
    // Deux appuis dans le même instant, avant que l'écran ne se redessine.
    const press = validate.props.onClick as (event: object) => void;
    const event = { nativeEvent: {}, stopPropagation: () => undefined };
    await act(async () => {
      press(event);
      press(event);
    });
    await fireEvent.press(validate);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(completeCalls()).toHaveLength(1);
    expect(button('Valider mon plat')).toBeDisabled();

    await act(async () => release(ok(cookResult())));
    expect(screen.getByTestId('reward-screen')).toBeOnTheScreen();
    expect(completeCalls()).toHaveLength(1);
  });
});

describe('PhotoScreen : erreurs du serveur', () => {
  it.each([
    ['session_expired', 'Session expirée', 'Voir les recettes'],
    ['session_not_running', 'Cette session est terminée', 'Voir les recettes'],
    ['session_not_found', 'Session introuvable', 'Voir les recettes'],
    ['not_authenticated', 'Tu as été déconnecté', 'Voir les recettes'],
    ['duplicate_photo', 'Cette photo a déjà servi', 'Reprendre une photo'],
    ['invalid_photo_path', 'Un petit souci technique', 'Reprendre une photo'],
    ['invalid_photo_sha256', 'Un petit souci technique', 'Reprendre une photo'],
    ['photo_missing', 'La photo n’est pas arrivée', 'Réessayer'],
    ['too_early', 'C’est un peu rapide !', 'Réessayer'],
  ])('%s → « %s » et « %s »', async (code, title, action) => {
    completeResponses = [fail(code)];
    await renderScreen();
    await takeAndValidate();
    const error = screen.getByTestId('submit-error');
    expect(error).toHaveTextContent(new RegExp(title));
    expect(button(action)).toBeOnTheScreen();
    expect(screen.queryByTestId('reward-screen')).toBeNull();
  });

  it('session expirée : retour aux recettes', async () => {
    completeResponses = [fail('session_expired')];
    await renderScreen();
    await takeAndValidate();
    await fireEvent.press(button('Voir les recettes'));
    expect(mockReplace).toHaveBeenCalledWith('/recettes');
  });

  it('too_early : dit combien de temps encore, d’après l’heure du serveur (R-09)', async () => {
    completeResponses = [fail('too_early'), ok(cookResult())];
    activeSession = ok({
      id: SESSION,
      recipe_id: RECIPE,
      recipe_version: 1,
      servings: 2,
      started_at: '2026-10-07T10:00:00+00:00',
      server_now: '2026-10-07T10:13:30+00:00', // 40 min actives → 16 min, reste 2 min 30
    });
    await renderScreen();
    await takeAndValidate();
    expect(screen.getByTestId('submit-error')).toHaveTextContent(/pourra être validé dans 3 min/);
    // Même photo, même session : le réessai ne renvoie pas la photo.
    await fireEvent.press(button('Réessayer'));
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('reward-screen')).toBeOnTheScreen();
  });

  it('too_early sans estimation possible : « c’est un peu rapide »', async () => {
    completeResponses = [fail('too_early')];
    activeSession = fail(NETWORK);
    await renderScreen();
    await takeAndValidate();
    expect(screen.getByTestId('submit-error')).toHaveTextContent(
      /un peu rapide pour cette recette/,
    );
  });

  it('photo_missing : le réessai renvoie la photo', async () => {
    completeResponses = [fail('photo_missing'), ok(cookResult())];
    await renderScreen();
    await takeAndValidate();
    await fireEvent.press(button('Réessayer'));
    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('reward-screen')).toBeOnTheScreen();
  });

  it('duplicate_photo : nouvelle photo, nouveau chemin et nouvelle empreinte (R-12)', async () => {
    completeResponses = [fail('duplicate_photo'), ok(cookResult())];
    await renderScreen();
    await takeAndValidate();
    await fireEvent.press(button('Reprendre une photo'));
    mockTakePicture.mockResolvedValue({ uri: 'file:///b.jpg', width: 4032 });
    await takeAndValidate();
    expect(mockUpload.mock.calls.map(([path]) => path)).toEqual([PATH_A, PATH_B]);
    expect(completeCalls()[1]?.[1]).toEqual({
      p_session_id: SESSION,
      p_photo_path: PATH_B,
      p_photo_sha256: SHA_B,
    });
    expect(screen.getByTestId('reward-screen')).toBeOnTheScreen();
  });
});
