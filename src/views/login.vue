<template>
<div class="flex min-h-full flex-col justify-center items-center px-6 py-12 lg:px-8 bg-white">
  <div class="sm:mx-auto sm:w-full sm:max-w-sm">
    <h2 class="mt-10 text-center text-2xl/9 font-bold tracking-tight text-gray-900">Sign in to your account</h2>
  </div>

  <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
    <form @submit.prevent="loginFormSubmit" method="POST" class="space-y-6">
      <div>
        <label for="email" class="block text-sm/6 font-medium text-gray-900">Email address</label>
        <div class="mt-2">
          <input 
            v-model="username" 
            id="email" 
            type="email" 
            name="email" 
            required 
            autocomplete="email" 
            class="block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 sm:text-sm/6" 
          />
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between">
          <label for="password" class="block text-sm/6 font-medium text-gray-900">Password</label>
          <div class="text-sm">
            <a href="#" class="font-semibold text-indigo-600 hover:text-indigo-500">Forgot password?</a>
          </div>
        </div>
        <div class="mt-2">
          <input 
            v-model="password" 
            id="password" 
            type="password" 
            name="password" 
            required 
            autocomplete="current-password" 
            class="block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 sm:text-sm/6" 
          />
        </div>
      </div>

      <div>
        <button type="submit" class="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
          <span v-if="loading == false">Sign in</span>
          <span v-else>Signing in...</span>
        </button>
      </div>
    </form>

    <p class="mt-10 text-center text-sm/6 text-gray-500">
      Not a member?
      <a href="#" class="font-semibold text-indigo-600 hover:text-indigo-500">Start a 14 day free trial</a>
    </p>
  </div>
</div>
</template>
<script setup>
    import {ref} from 'vue'
    import {useRouter, useRoute} from 'vue-router'
    import {login} from '../api/api'
    const router = useRouter()
    const loading = ref(false);
    const username = ref('')
    const password = ref('')
    async function loginFormSubmit(){
      try {
        loading.value = true
        const res = await login(username.value,password.value)
        if(res != null){
          router.push('/')
        }
        else{
          alert("Sai tài khoản hoặc mật khẩu")
        }
      } catch (error) {
        alert("Sai tài khoản hoặc mật khẩu")
      }
      finally{
        loading.value = false
      }
    }
</script>