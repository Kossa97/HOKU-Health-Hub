import { Suspense, type ReactNode } from 'react'
import { lazyPage, ReloadOnUpdate } from './lib/staleChunkReload'
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { DotLayer } from './features/dot/DotLayer'
import { Auth } from './pages/Auth'
import { publicPeptipediaRoutes } from './features/peptipedia/publicRoutes'
import { PeptipediaAppPage } from './features/peptipedia/PeptipediaAppPage'
import { ConsentGate } from './features/compliance/components/ConsentGate'
import { AppBackNavigation } from './components/navigation/AppBackNavigation'
import { SeitenSilhouette } from './components/ui/Silhouette'
import { silhouetteFuerPfad } from './components/ui/silhouetteTakt'
import { FehlerGrenze } from './components/FehlerGrenze'
import { VerbindungsHinweis } from './components/VerbindungsHinweis'

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
const ErnaehrungPage = lazyPage(() => import('./features/ernaehrung/ErnaehrungPage'), 'ErnaehrungPage')
const Progress = lazyPage(() => import('./pages/Progress'), 'Progress')
const TrainingPage = lazyPage(() => import('./features/training/TrainingPage'), 'TrainingPage')
const PdfProtokoll = lazyPage(() => import('./pages/PdfProtokoll'), 'PdfProtokoll')
const Protokoll = lazyPage(() => import('./pages/Protokoll'), 'Protokoll')
const BlutspiegelSimulation = lazyPage(() => import('./pages/BlutspiegelSimulation'), 'BlutspiegelSimulation')
const BlutspiegelDetail = lazyPage(() => import('./pages/BlutspiegelDetail'), 'BlutspiegelDetail')
const BlutspiegelManuell = lazyPage(() => import('./pages/BlutspiegelManuell'), 'BlutspiegelManuell')
const Legal = lazyPage(() => import('./pages/Legal'), 'Legal')
// Vorschau-Seiten nur in der Entwicklung — im fertigen Build fehlen Route und Code.
const DevPreviews = import.meta.env.DEV ? lazyPage(() => import('./pages/__DevPreviews'), 'DevPreviews') : null

// Während der Code einer Seite lädt, steht ihr Umriss da
function RouteFallback() {
  const { pathname } = useLocation()
  return <SeitenSilhouette art={silhouetteFuerPfad(pathname)} pfad={pathname} />
}

function LazyPage({ children, oeffentlich = false }: { children: ReactNode; oeffentlich?: boolean }) {
  const { pathname } = useLocation()
  // Öffentliche Seiten (Rechtstexte, geteilte Profile) haben kein App-Gerüst:
  // dort kein App-Umriss, nur der ruhige schwarze Grund.
  // Stürzt eine Seite ab, bleibt die Navigation stehen; der nächste
  // Seitenwechsel setzt die Grenze zurück.
  return (
    <FehlerGrenze ort="seite" schluessel={pathname}>
      <Suspense fallback={oeffentlich ? null : <RouteFallback />}>{children}</Suspense>
    </FehlerGrenze>
  )
}

function PersonalApp() {
  return (
      <AuthProvider>
        <Toaster
          position="top-center"
          // Unter Statusleiste und Dynamic Island, nicht dahinter
          containerStyle={{ top: 'max(16px, calc(env(safe-area-inset-top, 0px) + 8px))' }}
          toastOptions={{
            // Wie eine iOS-Meldung: feste dunkle Kapsel, keine farbige Kante
            style: { background: '#2c2c2e', color: '#fff', border: 'none', borderRadius: 999, padding: '10px 16px', fontSize: 15, boxShadow: '0 8px 30px rgba(0,0,0,0.5)' },
          }}
        />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          {DevPreviews && ['vialpreview', 'pdfpreview', 'befundpreview', 'pdfthemes'].map(preview => (
            <Route key={preview} path={`/__${preview}`} element={<LazyPage><DevPreviews /></LazyPage>} />
          ))}
          <Route path="/datenschutz" element={<LazyPage oeffentlich><Legal /></LazyPage>} />
          <Route path="/impressum" element={<LazyPage oeffentlich><Legal /></LazyPage>} />
          <Route path="/nutzungsbedingungen" element={<LazyPage oeffentlich><Legal /></LazyPage>} />
          <Route path="/u/:username" element={<LazyPage oeffentlich><PublicProfile /></LazyPage>} />
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
            <Route path="ernaehrung" element={<LazyPage><ErnaehrungPage /></LazyPage>} />
            <Route path="progress" element={<LazyPage><Progress /></LazyPage>} />
            <Route path="training" element={<LazyPage><TrainingPage /></LazyPage>} />
            <Route path="simulation" element={<LazyPage><BlutspiegelSimulation /></LazyPage>} />
            <Route path="simulation/neu" element={<LazyPage><BlutspiegelManuell /></LazyPage>} />
            <Route path="simulation/:key" element={<LazyPage><BlutspiegelDetail /></LazyPage>} />
          </Route>
        </Routes>
        {/* Dot über den Routen: derselbe auf der Anmeldung und in der App */}
        <DotLayer />
      </AuthProvider>
  )
}

export default function App() {
  // Äußerste Grenze: was keine Seite abfängt, endet hier statt weiß
  return <FehlerGrenze ort="app"><BrowserRouter><ReloadOnUpdate /><VerbindungsHinweis /><AppBackNavigation><Routes>
      {publicPeptipediaRoutes()}
      <Route path="*" element={<PersonalApp />} />
    </Routes></AppBackNavigation></BrowserRouter></FehlerGrenze>
}
