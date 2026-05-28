import { motion } from "motion/react";
import { LogOut, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../shared/ui/dropdown-menu";

interface HeaderProps {
  timeString: string;
  dateString: string;
  full_name?: string;
  username?: string;
  isAdmin?: boolean;
  isProfilePage?: boolean;
}

const handleLogOut = () => {
  localStorage.removeItem("access_token");
  sessionStorage.removeItem("access_token");
  window.location.href = "/login";
};

export function Header({
  timeString,
  dateString,
  full_name,
  username,
  isAdmin = false,
  isProfilePage = false,
}: HeaderProps) {
  const navigate = useNavigate();

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
          className="text-xs text-muted-foreground tracking-wide mb-2"
        >
          CENTRO DE TRABAJO
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-3xl font-semibold text-foreground m-0"
        >
          Buenos días {full_name?.split(" ")[0]}
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
          <div className="text-[13px] font-medium text-secondary-foreground">
            {timeString}
          </div>
          <div className="text-xs text-muted-foreground">
            {dateString?.toUpperCase()}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-primary text-primary-foreground text-sm font-semibold cursor-pointer select-none outline-none"
            >
              {full_name ? full_name.charAt(0).toUpperCase() : "U"}
            </motion.div>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="min-w-[220px]">
            {/* Cabecera informativa: nombre y email */}
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground leading-tight">
                {full_name ?? "Usuario"}
              </span>
              <span className="text-xs font-normal text-muted-foreground truncate">
                {username ?? ""}
              </span>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            {isAdmin ? (
              <DropdownMenuItem
                onClick={() => navigate("/dashboard/profile")}
                className="cursor-pointer"
              >
                <User />
                <span>Mi perfil</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {isProfilePage ? "Abierto" : "Admin"}
                </span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled>
                <User />
                <span>Mi perfil</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  Solo admin
                </span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {/* Cerrar sesión */}
            <DropdownMenuItem
              variant="destructive"
              onClick={handleLogOut}
              className="cursor-pointer"
            >
              <LogOut />
              <span>Cerrar sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>
    </motion.div>
  );
}
