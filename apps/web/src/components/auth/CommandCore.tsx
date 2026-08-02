const CORE_ARRIVAL = 'tf-core-in 1.1s ease-out 0.55s both';

export function CommandCore() {
  return (
    <div className="tf-core pointer-events-none absolute left-[27%] top-[64%] hidden h-[168px] w-[168px] lg:block">
      <div className="tf-core-shell relative h-full w-full">
        <div className="tf-core-glow tf-env-animate absolute -inset-10 rounded-full" />
        <div className="tf-core-frame-a absolute left-1/2 top-1/2 h-[160px] w-[160px] -translate-x-1/2 -translate-y-1/2 rotate-45" />
        <div className="tf-core-ring absolute left-1/2 top-1/2 h-[118px] w-[118px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <div className="tf-core-frame-b absolute left-1/2 top-1/2 h-[84px] w-[84px] -translate-x-1/2 -translate-y-1/2 rotate-45" />
        <div className="tf-core-cross absolute left-1/2 top-1/2 h-[64px] w-[64px] -translate-x-1/2 -translate-y-1/2">
          <span className="tf-core-cross-h absolute left-0 top-1/2 h-px w-full -translate-y-1/2" />
          <span className="tf-core-cross-v absolute left-1/2 top-0 h-full w-px -translate-x-1/2">
            <span className="tf-core-break absolute left-0 top-[54%] h-px w-full" />
          </span>
          <span className="absolute left-1/2 top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rotate-45 border" />
        </div>

        <span className="tf-core-anchor tf-core-anchor-a absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2" />
        <span className="tf-core-anchor tf-core-anchor-b absolute right-0 top-1/2 h-1.5 w-1.5 translate-x-1/2 -translate-y-1/2" />
        <span className="tf-core-anchor tf-core-anchor-c absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 translate-y-1/2" />

        <span className="tf-core-tick tf-core-tick-t absolute left-1/2 top-[18%] h-2 w-px -translate-x-1/2" />
        <span className="tf-core-tick tf-core-tick-r absolute right-[20%] top-1/2 h-px w-2 -translate-y-1/2" />
        <span className="tf-core-tick tf-core-tick-b absolute bottom-[16%] left-1/2 h-2 w-px -translate-x-1/2" />

        <span className="tf-core-arm tf-core-arm-in absolute left-0 top-1/2 h-px w-16 -translate-x-full -translate-y-1/2" />
        <span className="tf-core-arm tf-core-arm-out absolute right-0 top-1/2 h-px w-12 translate-x-full -translate-y-1/2" />

        <span className="tf-core-corridor tf-env-animate absolute left-1/2 top-1/2 h-px w-[360px]">
          <span className="tf-core-pulse tf-env-animate absolute -left-px top-1/2 h-[3px] w-[3px] -translate-y-1/2" />
        </span>
      </div>
    </div>
  );
}
