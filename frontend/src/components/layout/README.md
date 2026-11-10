# Layout Components

Vue 3 layout components for the Sub2API frontend, built with Composition API, TypeScript, and TailwindCSS.

## Components

### 1. AppLayout.vue

Main application layout. The console navigation is the top bar in `AppTopNav.vue`.

**Usage:**

```vue
<template>
  <AppLayout>
    <!-- Your page content here -->
    <h1>Dashboard</h1>
    <p>Welcome to your dashboard!</p>
  </AppLayout>
</template>

<script setup lang="ts">
import { AppLayout } from '@/components/layout'
</script>
```

**Features:**

- Top navigation from `AppTopNav.vue` (daily links, admin menu, account menu)
- Main content area with slot
- Narrow screens use the top menu button instead of a sidebar

Navigation items live in `consoleNav.ts`.

---

### 2. AppTopNav.vue

Shared console header for admins and users.

**Used automatically by AppLayout** - no need to import separately.

**Usage with custom title:**

```vue
<template>
  <AppLayout>
    <template #title> Custom Page Title </template>

    <!-- Your content -->
  </AppLayout>
</template>
```

**Used automatically by AppLayout** - no need to import separately.

---

### 4. AuthLayout.vue

Simple centered layout for authentication pages (login/register).

**Usage:**

```vue
<template>
  <AuthLayout>
    <!-- Login/Register form content -->
    <h2 class="mb-6 text-2xl font-bold">Login</h2>

    <form @submit.prevent="handleLogin">
      <!-- Form fields -->
    </form>

    <!-- Optional footer slot -->
    <template #footer>
      <p>
        Don't have an account?
        <router-link to="/register" class="text-indigo-600 hover:underline"> Sign up </router-link>
      </p>
    </template>
  </AuthLayout>
</template>

<script setup lang="ts">
import { AuthLayout } from '@/components/layout'

function handleLogin() {
  // Login logic
}
</script>
```

**Features:**

- Centered card container
- Gradient background
- Logo/brand at top
- Main content slot
- Optional footer slot for links
- Fully responsive

---

## Route Configuration

To set page titles in the header, add meta to your routes:

```typescript
// router/index.ts
const routes = [
  {
    path: '/dashboard',
    component: DashboardView,
    meta: { title: 'Dashboard' }
  },
  {
    path: '/api-keys',
    component: ApiKeysView,
    meta: { title: 'API Keys' }
  }
  // ...
]
```

---

## Store Dependencies

These components use the following Pinia stores:

- **useAuthStore**: For user authentication state, role checking, and logout
- **useAppStore**: For toast notifications and public settings

Make sure these stores are properly initialized in your app.

---

## Styling

All components use TailwindCSS utility classes. Make sure your `tailwind.config.js` includes the component paths:

```js
module.exports = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}']
  // ...
}
```

---

## Icons

Components use HTML entity icons for simplicity:

- &#128200; Chart (Dashboard)
- &#128273; Key (API Keys)
- &#128202; Bar Chart (Usage)
- &#127873; Gift (Redeem)
- &#128100; User (Profile)
- &#128268; Admin
- &#128101; Users
- &#128193; Folder (Groups)
- &#127760; Globe (Accounts)
- &#128260; Network (Proxies)
- &#127991; Ticket (Redeem Codes)

You can replace these with your preferred icon library (e.g., Heroicons, Font Awesome) if needed.

---

## Mobile Responsiveness

All components are fully responsive:

- **AppTopNav**: Daily links on wide screens; a top menu button below 1024px
- **AuthLayout**: Adapts padding and card size for mobile devices
