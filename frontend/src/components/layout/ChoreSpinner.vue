<template>
  <div
    class="chore-spinner-container"
    :class="[
      `size-${size}`,
      { 'is-inline': inline, 'is-hero': !inline }
    ]"
    role="status"
    :aria-label="activeLabel"
  >
    <!-- ==================== INLINE / BUTTON MODUS ==================== -->
    <div v-if="inline" class="chore-spinner-inline">
      <span class="inline-glyph" :class="`anim-${selectedVariant}`">
        <template v-if="selectedVariant === 'broom'">🧹</template>
        <template v-else-if="selectedVariant === 'washer'">🧺</template>
        <template v-else-if="selectedVariant === 'sponge'">🧽</template>
        <template v-else-if="selectedVariant === 'robot'">🤖</template>
        <template v-else-if="selectedVariant === 'plant'">🪴</template>
        <template v-else-if="selectedVariant === 'pan'">🍳</template>
        <template v-else-if="selectedVariant === 'trash'">🗑️</template>
        <template v-else-if="selectedVariant === 'rocket_task'">🚀</template>
        <template v-else-if="selectedVariant === 'ai_robot'">🤖</template>
        <template v-else-if="selectedVariant === 'handshake'">🤝</template>
        <template v-else-if="selectedVariant === 'clock_snooze'">⏰</template>
        <template v-else>🫧</template>
      </span>
      <span v-if="label" class="inline-label">{{ label }}</span>
    </div>

    <!-- ==================== HERO / CARD MODUS ==================== -->
    <div v-else class="chore-spinner-hero">
      <!-- 1. Besen wirbelt Staub & Glanz auf -->
      <div v-if="selectedVariant === 'broom'" class="anim-stage stage-broom">
        <div class="dust-floor"></div>
        <div class="broom-actor">🧹</div>
        <div class="dust-particle d1">💨</div>
        <div class="dust-particle d2">💨</div>
        <div class="sparkle-star s1">✨</div>
        <div class="sparkle-star s2">⭐</div>
      </div>

      <!-- 2. Waschmaschine schleudert Wäsche -->
      <div v-else-if="selectedVariant === 'washer'" class="anim-stage stage-washer">
        <div class="washer-frame">🧼</div>
        <div class="laundry-drum">
          <span class="cloth c1">👕</span>
          <span class="cloth c2">🧦</span>
          <span class="foam f1">🫧</span>
        </div>
      </div>

      <!-- 3. Schwamm schrubbt glänzende Teller -->
      <div v-else-if="selectedVariant === 'sponge'" class="anim-stage stage-sponge">
        <div class="dish">🍽️</div>
        <div class="sponge-actor">🧽</div>
        <div class="soap-bubble sb1">🫧</div>
        <div class="soap-bubble sb2">🫧</div>
        <div class="sparkle-star sp1">✨</div>
      </div>

      <!-- 4. Saugroboter flitzt über den Teppich -->
      <div v-else-if="selectedVariant === 'robot'" class="anim-stage stage-robot">
        <div class="carpet-track"></div>
        <div class="cleaner-bot">🤖</div>
        <div class="sparkle-trail st1">✨</div>
        <div class="sparkle-trail st2">✨</div>
      </div>

      <!-- 5. Pflanze wächst & wird gegossen -->
      <div v-else-if="selectedVariant === 'plant'" class="anim-stage stage-plant">
        <div class="water-can">🪴</div>
        <div class="water-drop wd1">💧</div>
        <div class="plant-flower">🌸</div>
      </div>

      <!-- 6. Pfanne brutzelt -->
      <div v-else-if="selectedVariant === 'pan'" class="anim-stage stage-pan">
        <div class="pan-actor">🍳</div>
        <div class="steam sm1">♨️</div>
        <div class="steam sm2">💨</div>
      </div>

      <!-- 7. Mülleimer & Recycling -->
      <div v-else-if="selectedVariant === 'trash'" class="anim-stage stage-trash">
        <div class="bin-actor">🗑️</div>
        <div class="falling-item fi1">📦</div>
        <div class="falling-item fi2">♻️</div>
      </div>

      <!-- 8. Raketen-Task (Macher-Deal) -->
      <div v-else-if="selectedVariant === 'rocket_task'" class="anim-stage stage-rocket">
        <div class="target-planet">🪐</div>
        <div class="rocket-ship">🚀</div>
        <div class="rocket-flame">🔥</div>
        <div class="sparkle-star rk-star">✨</div>
      </div>

      <!-- 9. KI-Copilot Roboter -->
      <div v-else-if="selectedVariant === 'ai_robot'" class="anim-stage stage-ai">
        <div class="ai-bot">🤖</div>
        <div class="ai-gear g1">⚙️</div>
        <div class="ai-idea">💡</div>
      </div>

      <!-- 10. Macher Handschlag -->
      <div v-else-if="selectedVariant === 'handshake'" class="anim-stage stage-handshake">
        <div class="handshake-actor">🤝</div>
        <div class="check-stamp">✅</div>
        <div class="sparkle-star hs-star">⭐</div>
      </div>

      <!-- 11. Snooze Wecker -->
      <div v-else-if="selectedVariant === 'clock_snooze'" class="anim-stage stage-clock">
        <div class="clock-actor">⏰</div>
        <div class="sleep-z z1">💤</div>
        <div class="sleep-z z2">💤</div>
      </div>

      <!-- Fallback / 12. Seifenblasen & Glanz -->
      <div v-else class="anim-stage stage-bubbles">
        <div class="bubble-center">🧼</div>
        <div class="soap-bubble bb1">🫧</div>
        <div class="soap-bubble bb2">🫧</div>
        <div class="sparkle-star bs1">✨</div>
      </div>

      <!-- Motivierendes Label -->
      <p class="chore-spinner-label">{{ activeLabel }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { pickSpinner, SPINNER_VARIANTS } from "@/lib/spinnerPick";

const props = defineProps({
  variant: {
    type: String,
    default: "",
  },
  context: {
    type: String,
    default: "chores",
  },
  label: {
    type: String,
    default: "",
  },
  inline: {
    type: Boolean,
    default: false,
  },
  size: {
    type: String,
    default: "md", // 'sm' | 'md' | 'lg'
  },
});

const selectedVariant = ref("broom");
const activeLabel = ref("Lädt…");

function resolveSpinner() {
  if (props.variant) {
    selectedVariant.value = props.variant;
    const found = SPINNER_VARIANTS.find((v) => v.id === props.variant);
    activeLabel.value = props.label || found?.defaultLabel || "Lädt…";
  } else {
    const picked = pickSpinner(props.context);
    selectedVariant.value = picked.variant;
    activeLabel.value = props.label || picked.label;
  }
}

resolveSpinner();
watch(() => [props.variant, props.context, props.label], resolveSpinner);
</script>

<style scoped>
.chore-spinner-container {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

/* ==================== SIZES ==================== */
.size-sm { font-size: 0.85rem; }
.size-md { font-size: 1rem; }
.size-lg { font-size: 1.25rem; }

/* ==================== INLINE / BUTTON STYLES ==================== */
.is-inline {
  display: inline-flex;
  vertical-align: middle;
}

.chore-spinner-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.inline-glyph {
  display: inline-block;
  line-height: 1;
  font-size: 1.15em;
  transform-origin: center center;
}

.inline-label {
  font-size: 0.9em;
  font-weight: 500;
  color: inherit;
}

/* Inline Glyph Keyframes */
.anim-broom { animation: inline-sweep 1.2s ease-in-out infinite; }
.anim-washer { animation: inline-spin 1s linear infinite; }
.anim-sponge { animation: inline-scrub 0.8s ease-in-out infinite alternate; }
.anim-robot { animation: inline-bounce 1s ease-in-out infinite alternate; }
.anim-rocket_task { animation: inline-launch 1.2s ease-in-out infinite; }
.anim-ai_robot { animation: inline-pulse 1.4s ease-in-out infinite; }
.anim-clock_snooze { animation: inline-tilt 1s ease-in-out infinite alternate; }

@keyframes inline-sweep {
  0%, 100% { transform: rotate(-12deg); }
  50% { transform: rotate(18deg) translateX(3px); }
}
@keyframes inline-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes inline-scrub {
  0% { transform: rotate(-10deg) scale(0.95); }
  100% { transform: rotate(15deg) scale(1.08); }
}
@keyframes inline-bounce {
  0% { transform: translateX(-3px); }
  100% { transform: translateX(3px); }
}
@keyframes inline-launch {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-4px) rotate(-8deg); }
}
@keyframes inline-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}
@keyframes inline-tilt {
  0% { transform: rotate(-15deg); }
  100% { transform: rotate(15deg); }
}

/* ==================== HERO STYLES ==================== */
.is-hero {
  padding: var(--md-sys-spacing-2xl, 32px);
  width: 100%;
}

.chore-spinner-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.anim-stage {
  position: relative;
  width: 180px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.chore-spinner-label {
  margin-top: var(--md-sys-spacing-md, 16px);
  font-size: var(--md-sys-typescale-body-medium, 14px);
  font-weight: 600;
  color: var(--md-sys-color-primary, #6750a4);
  letter-spacing: 0.3px;
  animation: pulse-label 1.8s ease-in-out infinite;
}

@keyframes pulse-label {
  0%, 100% { opacity: 0.85; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.02); }
}

/* 1. BROOM */
.broom-actor {
  font-size: 42px;
  animation: broom-sweep 1.6s ease-in-out infinite;
}
.dust-floor {
  position: absolute;
  bottom: 8px;
  width: 120px;
  height: 2px;
  background: var(--md-sys-color-outline-variant, #cac4d0);
  opacity: 0.4;
}
.dust-particle {
  position: absolute;
  font-size: 20px;
  opacity: 0;
}
.d1 { bottom: 12px; left: 35px; animation: dust-puff 1.6s 0.2s ease infinite; }
.d2 { bottom: 16px; right: 35px; animation: dust-puff 1.6s 0.8s ease infinite; }
.sparkle-star {
  position: absolute;
  font-size: 18px;
  animation: sparkle-pop 1.6s 0.9s ease infinite;
}
.s1 { top: 6px; right: 25px; }
.s2 { bottom: 20px; right: 10px; }

@keyframes broom-sweep {
  0%, 100% { transform: translateX(-25px) rotate(-15deg); }
  50% { transform: translateX(25px) rotate(20deg); }
}
@keyframes dust-puff {
  0% { opacity: 0; transform: scale(0.6) translateY(0); }
  40% { opacity: 0.9; transform: scale(1.2) translateY(-10px); }
  100% { opacity: 0; transform: scale(1.6) translateY(-18px); }
}
@keyframes sparkle-pop {
  0%, 100% { opacity: 0; transform: scale(0.4); }
  50% { opacity: 1; transform: scale(1.3) rotate(20deg); }
}

/* 2. WASHER */
.washer-frame {
  font-size: 48px;
  animation: washer-shake 0.3s ease-in-out infinite alternate;
}
.laundry-drum {
  position: absolute;
  display: flex;
  gap: 4px;
}
.cloth {
  font-size: 22px;
  animation: drum-tumble 1.2s linear infinite;
}
.c2 { animation-delay: 0.6s; }
.foam {
  font-size: 16px;
  animation: drum-tumble 1s linear infinite reverse;
}
@keyframes washer-shake {
  0% { transform: rotate(-2deg); }
  100% { transform: rotate(2deg) translateY(-2px); }
}
@keyframes drum-tumble {
  0% { transform: rotate(0deg) translateY(-10px); }
  50% { transform: rotate(180deg) translateY(10px); }
  100% { transform: rotate(360deg) translateY(-10px); }
}

/* 3. SPONGE */
.dish { font-size: 44px; }
.sponge-actor {
  position: absolute;
  font-size: 30px;
  animation: sponge-scrub 1.4s ease-in-out infinite;
}
.soap-bubble {
  position: absolute;
  font-size: 18px;
  animation: bubble-float 1.8s ease-in-out infinite;
}
.sb1 { top: 10px; left: 30px; animation-delay: 0.2s; }
.sb2 { bottom: 15px; right: 25px; animation-delay: 0.9s; }
.sp1 { top: 0; right: 40px; animation: sparkle-pop 1.5s 0.6s ease infinite; }

@keyframes sponge-scrub {
  0%, 100% { transform: translate(-15px, -8px) rotate(-15deg); }
  50% { transform: translate(15px, 8px) rotate(15deg); }
}
@keyframes bubble-float {
  0% { opacity: 0; transform: translateY(10px) scale(0.5); }
  50% { opacity: 1; transform: translateY(-8px) scale(1.1); }
  100% { opacity: 0; transform: translateY(-22px) scale(1.4); }
}

/* 4. ROBOT */
.carpet-track {
  position: absolute;
  bottom: 12px;
  width: 140px;
  height: 3px;
  background: repeating-linear-gradient(90deg, #b0bec5 0, #b0bec5 6px, transparent 6px, transparent 12px);
}
.cleaner-bot {
  font-size: 42px;
  animation: bot-cruise 2.4s ease-in-out infinite alternate;
}
.sparkle-trail {
  position: absolute;
  font-size: 16px;
  bottom: 18px;
}
.st1 { left: 40px; animation: sparkle-pop 1.8s ease infinite; }
.st2 { right: 40px; animation: sparkle-pop 1.8s 0.9s ease infinite; }

@keyframes bot-cruise {
  0% { transform: translateX(-40px); }
  100% { transform: translateX(40px); }
}

/* 5. PLANT */
.water-can { font-size: 40px; animation: can-pour 2s ease-in-out infinite; }
.water-drop {
  position: absolute;
  font-size: 16px;
  animation: drop-fall 2s ease-in infinite;
}
.wd1 { top: 38px; left: 82px; }
.plant-flower {
  position: absolute;
  font-size: 26px;
  bottom: 10px;
  right: 45px;
  animation: flower-bloom 2s ease-in-out infinite alternate;
}
@keyframes can-pour {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-25deg); }
}
@keyframes drop-fall {
  0%, 40% { opacity: 0; transform: translateY(-5px); }
  60% { opacity: 1; transform: translateY(12px); }
  100% { opacity: 0; transform: translateY(22px); }
}
@keyframes flower-bloom {
  0% { transform: scale(0.8); }
  100% { transform: scale(1.25); }
}

/* 6. PAN */
.pan-actor { font-size: 44px; animation: pan-flip 1.8s ease-in-out infinite; }
.steam { position: absolute; font-size: 18px; opacity: 0; }
.sm1 { top: 5px; left: 75px; animation: bubble-float 1.6s 0.2s ease infinite; }
.sm2 { top: 12px; left: 95px; animation: bubble-float 1.6s 0.7s ease infinite; }
@keyframes pan-flip {
  0%, 100% { transform: rotate(0deg) translateY(0); }
  45% { transform: rotate(-8deg) translateY(-2px); }
  50% { transform: rotate(18deg) translateY(-14px); }
  60% { transform: rotate(0deg) translateY(0); }
}

/* 7. TRASH */
.bin-actor { font-size: 44px; animation: bin-wobble 1.5s ease-in-out infinite; }
.falling-item { position: absolute; font-size: 20px; }
.fi1 { top: 5px; left: 55px; animation: drop-fall 1.5s ease infinite; }
.fi2 { top: 5px; right: 55px; animation: drop-fall 1.5s 0.7s ease infinite; }
@keyframes bin-wobble {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-6deg); }
  75% { transform: rotate(6deg); }
}

/* 8. ROCKET TASK */
.target-planet { position: absolute; top: 5px; right: 20px; font-size: 26px; }
.rocket-ship { font-size: 42px; animation: rocket-fly 2s ease-in-out infinite; }
.rocket-flame { position: absolute; font-size: 22px; animation: flame-flicker 0.4s ease-in-out infinite alternate; }
.rk-star { top: 12px; left: 20px; animation: sparkle-pop 1.8s ease infinite; }
@keyframes rocket-fly {
  0%, 100% { transform: translate(-25px, 15px) rotate(45deg); }
  50% { transform: translate(25px, -15px) rotate(55deg); }
}
@keyframes flame-flicker {
  0% { transform: translate(-36px, 24px) scale(0.85); opacity: 0.8; }
  100% { transform: translate(-38px, 26px) scale(1.2); opacity: 1; }
}

/* 9. AI ROBOT */
.ai-bot { font-size: 44px; animation: bot-think 1.6s ease-in-out infinite; }
.ai-gear { position: absolute; font-size: 20px; top: 8px; right: 40px; animation: drum-tumble 3s linear infinite; }
.ai-idea { position: absolute; font-size: 22px; top: -4px; left: 50px; animation: sparkle-pop 1.6s 0.4s ease infinite; }
@keyframes bot-think {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px) scale(1.05); }
}

/* 10. HANDSHAKE */
.handshake-actor { font-size: 44px; animation: hs-press 1.2s ease-in-out infinite; }
.check-stamp { position: absolute; font-size: 24px; top: 2px; right: 45px; animation: sparkle-pop 1.2s 0.3s ease infinite; }
.hs-star { top: 8px; left: 40px; animation: sparkle-pop 1.4s 0.6s ease infinite; }
@keyframes hs-press {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15) translateY(-3px); }
}

/* 11. CLOCK SNOOZE */
.clock-actor { font-size: 44px; animation: clock-ring 1.4s ease-in-out infinite; }
.sleep-z { position: absolute; font-size: 18px; color: var(--md-sys-color-primary, #6750a4); }
.z1 { top: 10px; right: 45px; animation: bubble-float 1.6s ease infinite; }
.z2 { top: 0; right: 30px; animation: bubble-float 1.6s 0.8s ease infinite; }
@keyframes clock-ring {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-12deg); }
  40% { transform: rotate(12deg); }
  60% { transform: rotate(-8deg); }
  80% { transform: rotate(8deg); }
}

/* 12. BUBBLES FALLBACK */
.bubble-center { font-size: 42px; animation: bot-think 1.8s ease-in-out infinite; }
.bb1 { top: 8px; left: 45px; animation: bubble-float 1.8s ease infinite; }
.bb2 { bottom: 12px; right: 45px; animation: bubble-float 1.8s 0.7s ease infinite; }
.bs1 { top: 4px; right: 55px; animation: sparkle-pop 1.6s 0.3s ease infinite; }
</style>
