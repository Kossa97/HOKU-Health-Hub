import { Suspense, type ReactNode } from 'react'
import { lazyPage, ReloadOnUpdate } from './lib/staleChunkReload'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Auth } from './pages/Auth'
import { publicPeptipediaRoutes } from './features/peptipedia/publicRoutes'
import { PeptipediaAppPage } from './features/peptipedia/PeptipediaAppPage'
import { ConsentGate } from './features/compliance/components/ConsentGate'
import { AppBackNavigation } from './components/navigation/AppBackNavigation'

const Home = lazyPage(() => import('./pages/Home'), 'Home')
const Dashboard = lazyPage(() => import('./pages/Dashboard'), 'Dashboard')
const MyStackPage = lazyPage(() => import('./features/my-stack/MyStackPage'), 'MyStackPage')
const Tagebuch = lazyPage(() => import('./pages/Tagebuch'), 'Tagebuch')
const Bewertungen = lazyPage(() => import('./pages/Bewertungen'), 'Bewertungen')
const Profil = lazyPage(() => import('./pages/Profil'), 'Profil')
const PublicProfile = lazyPage(() => import('./pages/PublicProfile'), 'PublicProfile')
const FAQ = lazyPage(() => import('./pages/FAQ'), 'FAQ')
const Rechner = lazyPage(() => import('./pages/Rechner'), 'Rechner')
const Blutwerte = lazyPage(() => import('./pages/Blutwerte'), 'Blutwerte')
const Health = lazyPage(() => import('./pages/Health'), 'Health')
const TheLab = lazyPage(() => import('./pages/TheLab'), 'TheLab')
const StudyDetail = lazyPage(() => import('./pages/StudyDetail'), 'StudyDetail')
const AdminPanel = lazyPage(() => import('./pages/lab/AdminPanel'), 'AdminPanel')
const InjektionsTracker = lazyPage(() => import('./pages/InjektionsTracker'), 'InjektionsTracker')
const Progress = lazyPage(() => import('./pages/Progress'), 'Progress')
const PdfProtokoll = lazyPage(() => import('./pages/PdfProtokoll'), 'PdfProtokoll')
const Protokoll = lazyPage(() => import('./pages/Protokoll'), 'Protokoll')
const BlutspiegelSimulation = lazyPage(() => import('./pages/BlutspiegelSimulation'), 'BlutspiegelSimulation')
const Legal = lazyPage(() => import('./pages/Legal'), 'Legal')
// Vorschau-Seiten nur in der Entwicklung — im fertigen Build fehlen Route und Code.
const DevPreviews = import.meta.env.DEV ? lazyPage(() => import('./pages/__DevPreviews'), 'DevPreviews') : null

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-sm text-slate-500">
      …
    </div>
  )
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

function PersonalApp() {
  return (
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: '#07091a', color: '#eaeefc', border: '1px solid rgba(0,204,245,0.15)' },
          }}
        />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          {DevPreviews && ['vialpreview', 'pdfpreview', 'befundpreview', 'pdfthemes'].map(preview => (
            <Route key={preview} path={`/__${preview}`} element={<LazyPage><DevPreviews /></LazyPage>} />
          ))}
          <Route path="/datenschutz" element={<LazyPage><Legal /></LazyPage>} />
          <Route path="/impressum" element={<LazyPage><Legal /></LazyPage>} />
          <Route path="/nutzungsbedingungen" element={<LazyPage><Legal /></LazyPage>} />
          <Route path="/u/:username" element={<LazyPage><PublicProfile /></LazyPage>} />
          <Route path="/" element={<ProtectedRoute><ConsentGate><Layout /></ConsentGate></ProtectedRoute>}>
            <Route index element={<LazyPage><Home /></LazyPage>} />
            <Route path="kalender" element={<LazyPage><Dashboard /></LazyPage>} />
            <Route path="my-stack" element={<LazyPage><MyStackPage /></LazyPage>} />
            <Route path="peptide" element={<Navigate to="/my-stack" replace />} />
            <Route path="lab" element={<LazyPage><TheLab /></LazyPage>} />
            <Route path="lab/peptipedia" element={<PeptipediaAppPage />} />
            <Route path="lab/peptipedia/:slug" element={<PeptipediaAppPage detail />} />
            <Route path="lab/study/:id" element={<LazyPage><StudyDetail /></LazyPage>} />
            <Route path="lab/admin" element={<LazyPage><AdminPanel /></LazyPage>} />
            <Route path="rechner" element={<LazyPage><Rechner /></LazyPage>} />
            <Route path="blutwerte" element={<LazyPage><Blutwerte /></LazyPage>} />
            <Route path="health" element={<LazyPage><Health /></LazyPage>} />
            <Route path="protokoll" element={<LazyPage><PdfProtokoll /></LazyPage>} />
            <Route path="protokoll/analyse" element={<LazyPage><Protokoll /></LazyPage>} />
            <Route path="the-lab" element={<LazyPage><TheLab /></LazyPage>} />
            <Route path="tagebuch" element={<LazyPage><Tagebuch /></LazyPage>} />
            <Route path="bewertungen" element={<LazyPage><Bewertungen /></LazyPage>} />
            <Route path="profil" element={<LazyPage><Profil /></LazyPage>} />
            <Route path="faq" element={<LazyPage><FAQ /></LazyPage>} />
            <Route path="injektionen" element={<LazyPage><InjektionsTracker /></LazyPage>} />
            <Route path="progress" element={<LazyPage><Progress /></LazyPage>} />
            <Route path="simulation" element={<LazyPage><BlutspiegelSimulation /></LazyPage>} />
          </Route>
        </Routes>
      </AuthProvider>
  )
}

export default function App() {
  return <BrowserRouter><ReloadOnUpdate /><AppBackNavigation><Routes>
      {publicPeptipediaRoutes()}
      <Route path="*" element={<PersonalApp />} />
    </Routes></AppBackNavigation></BrowserRouter>
}
