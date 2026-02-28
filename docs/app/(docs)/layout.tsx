import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { getPageMap } from 'nextra/page-map';
import 'nextra-theme-docs/style.css';
import type { ReactNode } from 'react';
import DocsThemeSwitch from '../../components/DocsThemeSwitch';

export const metadata = {
  title: {
    default: 'Inkio',
    template: '%s - Inkio',
  },
  description: 'A customizable React rich text editor toolkit',
};

const navbar = (
  <Navbar
    logo={<span style={{ fontWeight: 700 }}>📝 Inkio</span>}
    projectLink="https://github.com/rascalab/inkio"
  >
    <DocsThemeSwitch />
  </Navbar>
);

const footer = <Footer>MIT {new Date().getFullYear()} © Inkio</Footer>;

export default async function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <Layout
      navbar={navbar}
      footer={footer}
      pageMap={await getPageMap()}
      darkMode={true}
      docsRepositoryBase="https://github.com/rascalab/inkio/tree/main/docs"
      sidebar={{ defaultMenuCollapseLevel: 1 }}
      toc={{ backToTop: true }}
    >
      {children}
    </Layout>
  );
}
