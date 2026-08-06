import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import CaseStudy from './pages/CaseStudy';
import NotFound from './pages/NotFound';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/work/:slug" element={<CaseStudy />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
