const SUPABASE_URL = "https://aahrmanmulxjxjttfboj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_RrDuHGzrQQZc7U1d0BD5pw_hmk2Enlx";
const VOCAB_DATA_TABLE = "user_vocab_data";

window.vocabCloud = (() => {
  const hasSupabase = Boolean(window.supabase?.createClient);
  const isConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
  const client =
    hasSupabase && isConfigured
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        })
      : null;

  return {
    isConfigured,
    isAvailable: Boolean(client),
    client,
    getSession: () => client.auth.getSession(),
    signIn: (email, password) => client.auth.signInWithPassword({ email, password }),
    signUp: (email, password) =>
      client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.href
        }
      }),
    signOut: () => client.auth.signOut(),
    onAuthStateChange: (callback) => client.auth.onAuthStateChange(callback),
    loadUserData: (userId) =>
      client
        .from(VOCAB_DATA_TABLE)
        .select("custom_words, progress, updated_at")
        .eq("user_id", userId)
        .maybeSingle(),
    saveUserData: (userId, customWords, progress) =>
      client
        .from(VOCAB_DATA_TABLE)
        .upsert(
          {
            user_id: userId,
            custom_words: customWords,
            progress,
            updated_at: new Date().toISOString()
          },
          { onConflict: "user_id" }
        )
        .select("updated_at")
        .single()
  };
})();
