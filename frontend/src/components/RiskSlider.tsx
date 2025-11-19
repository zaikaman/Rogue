interface RiskSliderProps {
  value: 'low' | 'medium' | 'high'
  onChange: (value: 'low' | 'medium' | 'high') => void
}

export default function RiskSlider({ value, onChange }: RiskSliderProps) {
  const risks: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high']
  
  const getColor = (risk: string) => {
    if (risk === 'low') return 'from-success to-red-glow'
    if (risk === 'medium') return 'from-red-glow to-warning'
    return 'from-warning to-danger'
  }

  return (
    <div className="space-y-6">
      {/* Visual indicators */}
      <div className="flex justify-between items-center">
        {risks.map((risk) => {
          const isActive = value === risk
          return (
            <button
              key={risk}
              onClick={() => onChange(risk)}
              className={`
                flex-1 relative py-4 font-mono text-sm uppercase tracking-wide
                transition-all duration-300 rounded-sm mx-1
                ${
                  isActive
                    ? 'bg-gradient-to-r ' + getColor(risk) + ' text-noir-black font-bold glow-red scale-105'
                    : 'bg-noir-gray/30 text-gray-500 hover:text-white hover:bg-noir-gray/50'
                }
              `}
            >
              {risk}
              {isActive && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                  <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-red-glow" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Slider track */}
      <div className="relative">
        <div className="h-2 bg-noir-gray rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${getColor(value)} transition-all duration-500`}
            style={{
              width: value === 'low' ? '33%' : value === 'medium' ? '66%' : '100%',
            }}
          />
        </div>
        
        {/* Glowing indicator */}
        <div
          className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 transition-all duration-500"
          style={{
            left: value === 'low' ? '16.5%' : value === 'medium' ? '50%' : '83.5%',
          }}
        >
          <div className="w-4 h-4 bg-red-glow rounded-full glow-red-intense" />
        </div>
      </div>

      {/* Description */}
      <div className="terminal-border bg-noir-gray/30 rounded-sm p-4">
        <p className="text-sm text-gray-400 leading-relaxed">
          {value === 'low' && (
            <>
              <span className="text-success font-bold">CONSERVATIVE:</span> Prioritizes
              stable protocols like Aave with minimal leverage. Lower APY but maximum safety.
            </>
          )}
          {value === 'medium' && (
            <>
              <span className="text-red-glow font-bold">BALANCED:</span> Optimizes between
              yield and safety. Uses moderate leverage across vetted protocols.
            </>
          )}
          {value === 'high' && (
            <>
              <span className="text-warning font-bold">AGGRESSIVE:</span> Maximizes returns
              with higher leverage and emerging opportunities. Higher risk, higher reward.
            </>
          )}
        </p>
      </div>
    </div>
  )
}
