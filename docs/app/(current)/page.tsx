import LandingPage from '../../components/LandingPage';

export const metadata = {
  title: { absolute: 'inkio — React용 문서 에디터' },
  description: '기본 툴바나 노션 스타일 블록을 제공하는 React용 오픈소스 에디터. 메뉴와 도구를 앱에 맞게 구성할 수 있습니다.',
};

export default function LandingRoute() {
  return <LandingPage />;
}
