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

#include "ttinc.h"
#include "Ball.h"
#include "Sound.h"
#include "BaseView.h"
#include "Player.h"
#include "PlayerView.h"
#if defined(CHIYO)
#include "parts.h"
#include "loadparts.h"
#endif
#include "Network.h"
#include "MultiPlay.h"
#include "Event.h"
#include "Control.h"
#include "Launcher.h"
#include "HitMark.h"
#include "HowtoView.h"
#include "RCFile.h"
#ifdef LOGGING
#include "Logging.h"
#include "NoLogging.h"
#endif

#include <locale.h>
#include "CEGUIKey.h"

int LoadData( void *dum );

Ball theBall;

int theSocket = -1;

long wins	= 0;

RCFile *theRC = RCFile::GetRCFile();

long mode = MODE_OPENING;

SDL_mutex *loadMutex;

// If the client is configured as robot, it it 1. Otherwise it is 0.
int robot = 0;

void InitGame();
void StartGame();
void EndGame();
bool PollEvent();

#ifdef WIN32
#ifdef main
#undef main
#endif

#ifdef __CYGWIN__
#include <getopt.h>
#else
#include "win32/getopt.h"
#endif /*__CYGWIN__*/

static int win32ver = 0;	//0: win9x, 1: nt4 2: nt5

#if !defined(WIN32CONSOLE)
#define main theMain
#include "win32/GetArgs.h"
static int theMain(int argc, char** argv);
int WINAPI WinMain(HINSTANCE hInst, HINSTANCE hPrev, LPSTR CmdLine, int nShow)
{
  int argc;
  char **argv;

  GetArgs(&argc, &argv, GetCommandLineA());
  return theMain(argc, argv);
}
#endif /* WIN32CONSOLE */
#endif /* WIN32 */

#define PROBE_FILE "Parts/model/head01.dat"

int main(int argc, char** argv) {
  char *dataDir = NULL;

  if ( (access( PROBE_FILE, F_OK ) == 0) ) {
    dataDir = ".";
  } else {
#if !defined(WIN32)
#ifdef CANNONSMASH_DATADIR
    dataDir = CANNONSMASH_DATADIR;
#else
    fprintf( stderr, _("No datafile directory.\n") );
    exit(1);
#endif
#else
    char *path = (char*)alloca(MAX_PATH);
    *path = '\0';
    GetModuleFileNameA(GetModuleHandle(NULL), path, MAX_PATH);
    int l;
    for (l = strlen(path); l > 0 && '\\' != path[l]; --l);
    path[l] = '\0';
    dataDir = path;
#endif
  }

  if ( chdir( dataDir ) == -1 ) {
    fprintf( stderr, _("No datafile directory.\n") );
    exit(1);
  }

  printf( "datadir = %s\n", dataDir );

    /* initialize i18n */
#ifdef WIN32
    OSVERSIONINFO osver;
    osver.dwOSVersionInfoSize = sizeof(osver);
    GetVersionEx(&osver);
    if (osver.dwPlatformId != VER_PLATFORM_WIN32_NT) {
	win32ver = 0;
    } else if (osver.dwMajorVersion < 5) {
	win32ver = 1;
    } else {
	win32ver = 2;
    }

    switch (PRIMARYLANGID(GetUserDefaultLangID())) {
    default: break;
    case LANG_JAPANESE: putenv("LANGUAGE=ja"); break;
    case LANG_GERMAN:	putenv("LANGUAGE=de"); break;
    case LANG_FRENCH:	putenv("LANGUAGE=fr"); break;
    case LANG_PORTUGUESE:	putenv("LANGUAGE=po"); break;
    case LANG_HINDI:	putenv("LANGUAGE=hi"); break;
    }
	putenv("SDL_VIDEODRIVER=directx");
#endif

    setlocale(LC_ALL, "");
    setlocale(LC_NUMERIC, "C");

    putenv("SDL_MOUSE_RELATIVE=0");

#ifdef WIN32
    char *localedir = (char*)alloca(MAX_PATH);
    *localedir = '\0';
//    GetCurrentDirectory(MAX_PATH, localedir);
    strncpy(localedir, dataDir, MAX_PATH-1);
    strcat( localedir, "\\locale" );
    printf("\nlocale=%s\n", localedir);
    bindtextdomain ("csmash", localedir);
    textdomain ("csmash");

    bind_textdomain_codeset("csmash", "UTF-8");

    *localedir = '\0';
//    GetCurrentDirectory(MAX_PATH, localedir);
    strncpy(localedir, dataDir, MAX_PATH-1);
#else
    bindtextdomain(PACKAGE, LOCALEDIR);
    textdomain(PACKAGE);
#ifdef HAVE_BIND_TEXTDOMAIN_CODESET
    bind_textdomain_codeset(PACKAGE, "UTF-8");
#endif
#endif

    int c;
    while (EOF != (c = getopt(argc, argv, "schfS2Orlp:"))) {
        switch (c) {
        case 'h':
	    // brief help
	    printf("csmash [-s] [ip-address]");
	    return 0;
	case 's':
	    // Server mode
	    mode = MODE_MULTIPLAYSELECT;
	    theRC->serverName[0] = '\0';
	    break;
	case 'c':
	    // Client mode
	    mode = MODE_MULTIPLAYSELECT;
	    theRC->serverName[0] = 1;	// :-p
	    break;
	case 'p':
	    // set the csmash_port
	    theRC->csmash_port = (short)atoi(optarg);
	    if (0 == theRC->csmash_port) theRC->csmash_port = CSMASH_PORT;
	    break;
	case 'f':
	    // Fullscreen mode
	    theRC->fullScreen = true;
	    break;
	case 'S':
	    // Simple mode
	    theRC->gmode = GMODE_SIMPLE;
	    theRC->isTexture = false;
	    break;
	case '2':
	    // Simple mode
	    theRC->gmode = GMODE_2D;
	    mode = MODE_SELECT;
	    break;
	case 'r':
	    // Robot mode
	    robot = 1;
	    break;
	case 'l':
	    // Log replay mode
	    mode = MODE_LOGPLAY;
	    break;
	}
    }

    if (mode != MODE_MULTIPLAYSELECT && argc > optind) {
      // Client mode
      mode = MODE_MULTIPLAYSELECT;
      strncpy(theRC->serverName, argv[optind], sizeof(theRC->serverName));
    }

  struct timeb tb;
#ifdef WIN32
  ftime( &tb );
#else
  struct timeval tv;
  struct timezone tz;
  gettimeofday( &tv, &tz );
  tb.time = tv.tv_sec;
  tb.millitm = tv.tv_usec/1000;
#endif

  srand(tb.millitm);

  EndianCheck();

  loadMutex = SDL_CreateMutex();
  /* Threading will be disabled until locale becomes thread-safe. */
  //SDL_CreateThread( LoadData, NULL );
  LoadData(NULL);

  theRC->ReadRCFile();

  ::StartGame();
  ::EndGame();

  return 0;
}

void
StartGame() {
  try {
    ::InitGame();
    while ( PollEvent() );
  } catch ( NetworkError ) {
    ::EndGame();
    throw NetworkError();
  }
  ::EndGame();
}

void
InitGame() {
  BaseView::TheView()->Init();

  if ( mode == MODE_OPENING && (access( OPENINGFILENAME, F_OK ) != 0) ) {
    mode = MODE_TITLE;
  }

#ifdef LOGGING
  if (mode == MODE_LOGPLAY) {
    NoLogging::GetLogging()->Init();
  } else {
    Logging::GetLogging()->Init();
  }
#endif

  Sound::TheSound()->Init( theRC->sndMode, theRC->sndVolume );

  SDL_EnableUNICODE(1);
#ifdef WIN32
  SDL_SysIMinfo info;

  SDL_SetIMPosition(0, 0);
  SDL_VERSION(&info.version);
  SDL_GetIMInfo(&info);
#endif

#if defined(CHIYO)
  parts::realizeobjects();
#endif

  Event::TheEvent()->Init();

}

void EndGame()
{
  Control::ClearControl();
  BaseView::TheView()->QuitGame();
  Sound::TheSound()->Clear();

  HitMark::m_textures[0] = 0;
  HowtoView::m_textures[0] = 0;

  theSocket = -1;

  wins = 0;
  mode = MODE_TITLE;

#if defined(CHIYO)
  parts::unrealizeobjects();
#endif

  SDL_Quit();
}

bool PollEvent() {
  SDL_Event event;

  while ( SDL_PollEvent(&event) ) {
    // Later, change GLUT-like function to SDL
    CEGUI::uint kc;
	Uint16 buf[65536];
	int charNum;
    switch ( event.type ) {
    case SDL_KEYDOWN:
      if (charNum = SDL_FlushIMString(buf)) {
		for (int i=0; i < charNum; i++) {
          CEGUI::System::getSingleton().injectChar(buf[i]);
		}
	  } else {
		kc = SDLKeyToCEGUIKey(event.key.keysym.sym);
		CEGUI::System::getSingleton().injectKeyDown(kc);
		CEGUI::System::getSingleton().injectChar(event.key.keysym.unicode);
		Event::KeyboardFunc( event, 0, 0 );
	  }
      break;

    case SDL_KEYUP:
      kc = SDLKeyToCEGUIKey(event.key.keysym.sym);
      CEGUI::System::getSingleton().injectKeyUp(kc);
      Event::KeyUpFunc( event, 0, 0 );
      break;

    case SDL_MOUSEMOTION:
      CEGUI::System::getSingleton().
	injectMousePosition(static_cast<float>(event.motion.x),
			    static_cast<float>(event.motion.y));
      Event::MotionFunc( event.motion.x, event.motion.y );
      break;

    case SDL_MOUSEBUTTONDOWN:
      switch (event.button.button) {
      case SDL_BUTTON_LEFT:
	CEGUI::System::getSingleton().injectMouseButtonDown(CEGUI::LeftButton);
	break;
      case SDL_BUTTON_MIDDLE:
	CEGUI::System::getSingleton().injectMouseButtonDown(CEGUI::MiddleButton);
	break;
      case SDL_BUTTON_RIGHT:
	CEGUI::System::getSingleton().injectMouseButtonDown(CEGUI::RightButton);
	break;
      case SDL_BUTTON_WHEELDOWN:
	CEGUI::System::getSingleton().injectMouseWheelChange( -1 );
	break;
      case SDL_BUTTON_WHEELUP:
	CEGUI::System::getSingleton().injectMouseWheelChange( +1 );
	break;
      }
      Event::ButtonFunc( event.button.button, event.button.type,
			 event.motion.x, event.motion.y );
      break;
    case SDL_MOUSEBUTTONUP:
      switch (event.button.button) {
      case SDL_BUTTON_LEFT:
	CEGUI::System::getSingleton().injectMouseButtonUp(CEGUI::LeftButton);
	break;
      case SDL_BUTTON_MIDDLE:
	CEGUI::System::getSingleton().injectMouseButtonUp(CEGUI::MiddleButton);
	break;
      case SDL_BUTTON_RIGHT:
	CEGUI::System::getSingleton().injectMouseButtonUp(CEGUI::RightButton);
	break;
      }
      Event::ButtonFunc( event.button.button, event.button.type,
			 event.motion.x, event.motion.y );
      break;

    case SDL_QUIT:
      return false;

    case SDL_SYSWMEVENT:
      break;
    }
  }

  Event::IdleFunc();

  return true;
}

int
LoadData( void *dum ) {
  SDL_mutexP( loadMutex );

  if ( theRC->gmode != GMODE_2D )
    PlayerView::LoadData(NULL);

  SDL_mutexV( loadMutex );

  return 0;
}
