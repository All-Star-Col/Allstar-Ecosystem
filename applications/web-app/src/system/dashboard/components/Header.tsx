import { motion } from 'motion/react';

interface HeaderProps {
  timeString: string;
  dateString: string;
  name? : string;
}

export function Header({ timeString, dateString,  name }: HeaderProps) {
  return (
	<motion.div 
	  initial={{ opacity: 0, y: -20 }}
	  animate={{ opacity: 1, y: 0 }}
	  transition={{ duration: 0.5, delay: 0.1 }}
	  className="flex justify-between items-start mb-8"
	>
	  {/* Left side */}
	  <div>
		<motion.div 
		  initial={{ opacity: 0 }}
		  animate={{ opacity: 1 }}
		  transition={{ duration: 0.5, delay: 0.2 }}
		  style={{ fontSize: '12px', color: 'rgba(47, 51, 57, 0.6)', letterSpacing: '0.5px', marginBottom: '8px' }}
		>
		  CENTRO DE TRABAJO
		</motion.div>
		<motion.h1 
		  initial={{ opacity: 0, x: -20 }}
		  animate={{ opacity: 1, x: 0 }}
		  transition={{ duration: 0.5, delay: 0.3 }}
		  style={{ fontSize: '32px', fontWeight: 600, color: '#122337', margin: 0 }}
		>
		  Buenos días {name?.split(' ')[0]}
		</motion.h1>
	  </div>
	  
	  {/* Right side */}
	  <motion.div 
		initial={{ opacity: 0, x: 20 }}
		animate={{ opacity: 1, x: 0 }}
		transition={{ duration: 0.5, delay: 0.2 }}
		className="flex items-center gap-3"
	  >
		<div className="text-right mr-2">
		  <div style={{ fontSize: '13px', fontWeight: 500, color: '#2f3339' }}>
			{timeString}
		  </div>
		  <div style={{ fontSize: '12px', color: 'rgba(47, 51, 57, 0.6)' }}>
			{dateString?.toUpperCase()}
		  </div>
		</div>

		<motion.div 
		  whileHover={{ scale: 1.1, rotate: 5 }}
		  whileTap={{ scale: 0.95 }}
		  className="rounded-full flex items-center justify-center"
		  style={{
			width: '36px',
			height: '36px',
			backgroundColor: '#122337',
			color: '#f6f5f0',
			fontSize: '14px',
			fontWeight: 600,
			cursor: 'pointer'
		  }}
		>
		  {name ? name.charAt(0).toUpperCase() : 'U'}
		</motion.div>
	  </motion.div>
	</motion.div>
  );
}
