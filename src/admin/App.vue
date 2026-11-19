<script lang="ts">
export type {
  AdminHeaderModel, AdminOverviewModel, AdminIssuesModel,
  AdminVisitorsModel, AdminResultsModel, AdminAccountsModel,
} from './adminController';
</script>

<script setup lang="ts">
import {createElement} from 'react';
import ReactSurface from '../react/ReactSurface.vue';
import {AdminApp} from './App';
const draw = () => createElement(AdminApp);
</script>

<template>
  <ReactSurface :draw="draw"/>
</template>
