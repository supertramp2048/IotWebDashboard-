import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import login from '../views/login.vue'
import { name } from '@vue/eslint-config-prettier/skip-formatting'
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: {requireAuth: true}
    },
    {
      path: '/login',
      name: 'login',
      component: login
    },
    
  ],
})
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('tb_token');
  if(to.meta.requireAuth && !token){
    next({name: 'login'})
  }
  else{
    next()
  }
})

export default router

