export default function Footer() {
  return (
    <footer className="journal-footer relative border-t border-hairline">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="max-w-5xl mx-auto px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col sm:flex-row gap-8 sm:gap-16">
          <div className="sm:w-[60%]">
            <span className="font-display text-xl text-ink tracking-[-0.5px]">Cloutains的旅程</span>
            <p className="text-xs text-muted-soft mt-3 leading-relaxed max-w-xs">
              用脚步丈量世界，记录每一段旅程
            </p>
          </div>
          <div className="sm:w-[40%] sm:text-right flex flex-col gap-6 sm:items-end">
            <p className="font-display text-base text-muted-soft italic leading-relaxed">
              &ldquo;读万卷书<br />行万里路&rdquo;
            </p>
            <p className="text-[11px] text-muted-soft font-sans">
              &copy; {new Date().getFullYear()} Cloutains
            </p>
            <a href="https://fontsource.org/fonts/noto-serif-sc" className="text-[11px] text-muted underline underline-offset-4">
              字体：思源宋体
            </a>
          </div>
        </div>
        <nav
          aria-label="网站备案信息"
          className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline-soft pt-4 font-sans text-[11px] text-muted-soft"
        >
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 transition-colors hover:text-primary"
          >
            闽ICP备2026039173号-1
          </a>
          <a
            href="https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=35021202001030"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 transition-colors hover:text-primary"
          >
            闽公网安备35021202001030号
          </a>
        </nav>
      </div>
    </footer>
  );
}
