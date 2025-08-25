/* $Id$ */

// Copyright (C) 2000-2004, 2007  Kanna Yoshihiro
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA

#ifndef _ttinc_
#define _ttinc_

#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#ifdef _WIN32
# define WIN32
# if (_MSC_VER >= 1200)
#  pragma warning(disable: 4786)	/* Symbol trucated to 255chars */
# endif
#endif

//#define SCREENSHOT

#define MAJOR_VERSION	0
#define MIDDLE_VERSION	7
#define MINOR_VERSION	0

#define CSMASH_PORT	3573	// TCP Port num.

// Window size
#define WINXSIZE	800
#define WINYSIZE	600
// Field size
#define AREAXSIZE	8.0F
#define AREAYSIZE	12.0F
#define AREAZSIZE	6.0F

// Player size
#define UPPERARM	0.25F
#define FOREARM		0.30F

// Table size
#define TABLELENGTH	((float)(2.74))
#define TABLEWIDTH	((float)(1.525))
#define TABLEHEIGHT	((float)(0.76))
#define	TABLETHICK	((float)(0.1))
// Net height
#define NETHEIGHT	((float)(0.1525))
// Ball R
#define BALL_R		((float)(0.019))

#define TABLE_E		((float)(0.8))
#define PHY		((float)(0.15))

// Image size
#define IMAGE_WIDTH	256
#define IMAGE_HEIGHT	256

#define GRAVITY(spin)	((float)(9.8+spin*5))

#define	TICK		(0.01F)		// Turn length (in second)

// Key
#define KEY_LEFT    (1<<0)
#define KEY_RIGHT   (1<<1)
#define KEY_FORWARD (1<<2)
#define KEY_BACK    (1<<3)
#define KEY_UP      (1<<4)
#define KEY_DOWN    (1<<5)
#define KEY_HIT     (1<<6)

// Mouse
#define BUTTON_LEFT   (1<<0)
#define BUTTON_MIDDLE (1<<1)
#define BUTTON_RIGHT  (1<<2)

#define MAX_HISTORY (1024)

// Self Model mode
#define MODEL_TRANSPARENT   (0)
#define MODEL_WIREFRAME     (1)
#define MODEL_ARMONLY       (2)

// Graphics mode
#define GMODE_FULL          (0)
#define GMODE_SIMPLE        (1)
#define GMODE_2D            (2)
#define GMODE_TOON          (3)

// Play mode
#define MODE_SOLOPLAY       (1)	// Play VS COM
#define MODE_MULTIPLAY      (2)	// Play VS MAN
#define MODE_SELECT         (3)	// Player Select
#define MODE_TITLE          (4)	// Title
#define MODE_HOWTO          (5)	// How to Play
#define MODE_TRAININGSELECT (6)	// Training Select
#define MODE_TRAINING       (7)	// Training
#define MODE_OPENING        (8)	// Opening
#define MODE_PRACTICESELECT (9)	// Practice Select
#define MODE_PRACTICE       (10)// Practice
#define MODE_MULTIPLAYSELECT (11)// Play VS MAN Select
#define MODE_LOGPLAY        (12)// Log file player mode

// Sound
#define SOUND_RACKET (0)
#define SOUND_TABLE  (1)
#define SOUND_CLICK  (2)
#define SOUND_OPENING (3)
#define SOUND_LOVEALL (4)
#define SOUND_ALL (5)

// protocol
#define IPv4 (0)
#define IPv6 (1)

#define OPENINGFILENAME "danslatristesse2-48.ogg"

// Communication
#define DATA_PV      (0)
#define DATA_PS      (1)
#define DATA_BT      (2)
#define DATA_BV      (3)
#define DATA_PT      (4)

// Sound
#define SOUND_NONE	0
#define SOUND_SDL	1

// Others
#define RAND(N) ((int)((float)(N)*rand()/RAND_MAX))

// Player::m_swingError
#define SWING_PERFECT	0
#define SWING_GREAT	1
#define SWING_GOOD	2
#define SWING_BOO	3
#define SWING_MISS	4

#define PLAYERS 3
#define TRAININGPLAYERS 2

// Game level and mode
enum level {LEVEL_EASY, LEVEL_NORMAL, LEVEL_HARD, LEVEL_TSUBORISH};
enum mode  {GAME_5PTS, GAME_11PTS, GAME_21PTS};

// Log
//#define LOGGING

#ifndef MKDEP_IGN_SYSINC

#ifdef WIN32
#define NOMINMAX
#define VC_EXTRALEAN
#include <winsock2.h>
#ifdef ENABLE_IPV6
#include <WS2tcpip.h>
#endif
#include <windows.h>
#endif

#ifdef HAVE_UNISTD_H
#include <unistd.h>
#endif
#include <stdio.h>
#include <stdlib.h>
#include <sys/types.h>
#include <sys/timeb.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <string.h>
#include <ctype.h>
#include <math.h>
#include <float.h>
#include <assert.h>

#ifndef WIN32
#include <sys/time.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>

#define SOCKET int
#define closesocket(A) close(A)
#else /* WIN32 */
#include <io.h>
#include <direct.h>

#define F_OK 0 /* stat, file is exist */
#define snprintf _snprintf
#define vsnprintf _vsnprintf
typedef int socklen_t;		/* mimic Penguin's socklen type */
#endif   /* !WIN32 */

#include <GL/gl.h>
#include <GL/glu.h>

#include <SDL/SDL.h>
#include <SDL/SDL_image.h>
#include <SDL/SDL_thread.h>

#ifdef HAVE_LIBSDL_MIXER
#include <SDL/SDL_mixer.h>
#endif

#include <CEGUI/CEGUI.h>
#include <CEGUI/RendererModules/OpenGLGUIRenderer/openglrenderer.h>
#include <CEGUI/CEGUIXMLAttributes.h>

#include <libintl.h>
#define  gettext_noop(String)  (String)
#define _(String) gettext (String)
#define N_(String) gettext_noop (String)

#endif /* MKDEP_IGN_SYSINC */

#ifdef HAVE_LIBZ
#include "z.h"
#endif

void xerror(const char *str, ...);

#ifdef WIN32
#pragma warning(disable: 4244 4305)
#endif

#endif // _ttinc_
