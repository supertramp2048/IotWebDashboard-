<script setup>
defineProps({
  loading: {
    type: Boolean,
    default: false
  }
});
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div 
      v-if="loading" 
      class="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[2px] rounded-[inherit] cursor-wait"
    >
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600"></div>
    </div>
  </Transition>
</template>